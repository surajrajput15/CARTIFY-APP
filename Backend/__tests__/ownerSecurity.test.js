const {
  isOwnerEmail,
  applyOwnerRole,
  ownerOnly,
  getAdminEmails,
  validateAdminEmailsConfig,
  normalizeEmail,
} = require('../utils/ownerValidator');

describe('Owner & Admin Security Verification Suite (Blocker 2 Fix)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Production Startup Configuration Validation', () => {
    it('fails safely when ADMIN_EMAILS is missing in production', () => {
      delete process.env.ADMIN_EMAILS;
      const result = validateAdminEmailsConfig();
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/missing or empty/i);
    });

    it('fails safely when ADMIN_EMAILS is blank/whitespace in production', () => {
      process.env.ADMIN_EMAILS = '   ';
      const result = validateAdminEmailsConfig();
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/missing or empty/i);
    });

    it('fails safely when ADMIN_EMAILS contains invalid email syntax', () => {
      process.env.ADMIN_EMAILS = 'invalid-email-string, owner@cartify.com';
      const result = validateAdminEmailsConfig();
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid email address/i);
    });

    it('succeeds with valid comma-separated email list', () => {
      process.env.ADMIN_EMAILS = 'Owner1@Cartify.com,  owner2@cartify.com  ';
      const result = validateAdminEmailsConfig();
      expect(result.valid).toBe(true);
      expect(result.count).toBe(2);
      expect(result.emails).toEqual(['owner1@cartify.com', 'owner2@cartify.com']);
    });
  });

  describe('2. Hardcoded Fallback Removal in Production', () => {
    it('does NOT include admin@cartify.com fallback in production when ADMIN_EMAILS has another email', () => {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_EMAILS = 'real-owner@cartify.com';

      const adminEmails = getAdminEmails();
      expect(adminEmails).toEqual(['real-owner@cartify.com']);
      expect(adminEmails).not.toContain('admin@cartify.com');
      expect(isOwnerEmail('admin@cartify.com')).toBe(false);
      expect(isOwnerEmail('real-owner@cartify.com')).toBe(true);
    });

    it('does NOT fallback to admin@cartify.com in production even if ADMIN_EMAILS is empty', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_EMAILS;

      const adminEmails = getAdminEmails();
      expect(adminEmails).toEqual([]);
      expect(isOwnerEmail('admin@cartify.com')).toBe(false);
    });

    it('allows safe fallback to admin@cartify.com ONLY in non-production when ADMIN_EMAILS is unset', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ADMIN_EMAILS;

      const adminEmails = getAdminEmails();
      expect(adminEmails).toContain('admin@cartify.com');
      expect(isOwnerEmail('admin@cartify.com')).toBe(true);
    });
  });

  describe('3. Privilege Escalation Prevention & Role Synchronization', () => {
    it('denies owner privileges to unconfigured admin@cartify.com in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_EMAILS = 'official-owner@cartify.com';

      const fakeAdminUser = {
        email: 'admin@cartify.com',
        isAdmin: true,
        role: 'admin',
        save: jest.fn().mockResolvedValue(true),
      };

      await applyOwnerRole(fakeAdminUser);

      // Must be stripped of admin rights because email is not in ADMIN_EMAILS
      expect(fakeAdminUser.isAdmin).toBe(false);
      expect(fakeAdminUser.role).toBe('customer');
      expect(fakeAdminUser.save).toHaveBeenCalled();
    });

    it('promotes legitimately configured owner email in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_EMAILS = 'official-owner@cartify.com';

      const legitimateOwner = {
        email: 'official-owner@cartify.com',
        isAdmin: false,
        role: 'customer',
        save: jest.fn().mockResolvedValue(true),
      };

      await applyOwnerRole(legitimateOwner);

      expect(legitimateOwner.isAdmin).toBe(true);
      expect(legitimateOwner.role).toBe('admin');
      expect(legitimateOwner.save).toHaveBeenCalled();
    });

    it('strips ordinary customer of any spoofed admin flags', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_EMAILS = 'official-owner@cartify.com';

      const attackerUser = {
        email: 'attacker@evil.com',
        isAdmin: true,
        role: 'admin',
        save: jest.fn().mockResolvedValue(true),
      };

      await applyOwnerRole(attackerUser);

      expect(attackerUser.isAdmin).toBe(false);
      expect(attackerUser.role).toBe('customer');
    });
  });

  describe('4. ownerOnly Middleware Protection', () => {
    it('blocks unauthenticated requests with 401', () => {
      const req = { user: null };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      ownerOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('blocks regular admin who is NOT the owner with 403', () => {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_EMAILS = 'verified-owner@cartify.com';

      const req = {
        user: {
          email: 'staff-admin@cartify.com',
          isAdmin: true,
          role: 'admin',
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      ownerOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringMatching(/Owner-only/i),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('authorizes verified owner on ownerOnly routes', () => {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_EMAILS = 'verified-owner@cartify.com';

      const req = {
        user: {
          email: 'verified-owner@cartify.com',
          isAdmin: true,
          role: 'admin',
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      ownerOnly(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
