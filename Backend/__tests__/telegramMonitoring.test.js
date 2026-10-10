const { sanitizePayload, maskEmail, maskPhone, sanitizeAddress } = require('../services/telegram/sanitizer');
const { AlertThrottler, alertThrottler } = require('../services/telegram/alertThrottler');
const { formatAlertMessage, escapeHtml } = require('../services/telegram/messageFormatter');
const { TelegramClient, telegramClient } = require('../services/telegram/telegramClient');
const { notifyMonitoring, buildThrottleKey, EVENT_SEVERITIES } = require('../services/telegram/monitoringService');
const MonitoringLog = require('../models/MonitoringLog');

describe('Telegram Monitoring System', () => {
  describe('1. Sanitizer & Redaction Module', () => {
    it('should mask email addresses correctly', () => {
      expect(maskEmail('surajdona2005@gmail.com')).toBe('s****5@gmail.com');
      expect(maskEmail('ab@test.com')).toBe('a*@test.com');
      expect(maskEmail('a@test.com')).toBe('a*@test.com');
      expect(maskEmail(null)).toBe('[UNKNOWN]');
    });

    it('should mask phone numbers correctly', () => {
      expect(maskPhone('+919876543210')).toBe('******3210');
      expect(maskPhone('123')).toBe('[REDACTED]');
      expect(maskPhone(null)).toBe('[REDACTED]');
    });

    it('should sanitize address details preserving city and state', () => {
      const address = {
        street: '123 MG Road Sector 4',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560001',
      };
      const sanitized = sanitizeAddress(address);
      expect(sanitized.city).toBe('Bengaluru');
      expect(sanitized.state).toBe('Karnataka');
      expect(sanitized.pinCode).toBe('560***');
      expect(sanitized.street).toBeUndefined();
    });

    it('should redact sensitive keys completely and mask PII recursively', () => {
      const sensitiveData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'SuperSecretPassword123!',
        passwordConfirm: 'SuperSecretPassword123!',
        otp: '123456',
        token: 'jwt-access-token-xyz',
        accessToken: 'bearer-xyz',
        refreshToken: 'refresh-xyz',
        razorpay_signature: 'sig_abcdef123456',
        secret: 'app-secret',
        authorization: 'Bearer token123',
        billing: {
          phone: '+919988776655',
          cvv: '123',
          cardNumber: '4111111111111234',
        },
        items: [
          { productId: 'prod_1', price: 500 },
          { userPassword: 'nested-pass' },
        ],
      };

      const sanitized = sanitizePayload(sensitiveData);

      // Sensitive fields must be marked [REDACTED]
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.passwordConfirm).toBe('[REDACTED]');
      expect(sanitized.otp).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      expect(sanitized.razorpay_signature).toBe('[REDACTED]');
      expect(sanitized.secret).toBe('[REDACTED]');
      expect(sanitized.authorization).toBe('[REDACTED]');
      expect(sanitized.billing.cvv).toBe('[REDACTED]');
      expect(sanitized.billing.cardNumber).toBe('[REDACTED]');
      expect(sanitized.items[1].userPassword).toBe('[REDACTED]');

      // PII must be masked
      expect(sanitized.email).toBe('j****e@example.com');
      expect(sanitized.billing.phone).toBe('******6655');
      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.items[0].productId).toBe('prod_1');
    });

    it('should handle edge cases without throwing', () => {
      expect(sanitizePayload(null)).toBeNull();
      expect(sanitizePayload(undefined)).toBeUndefined();
      expect(sanitizePayload('simple-string')).toBe('simple-string');
      expect(sanitizePayload(12345)).toBe(12345);
      expect(sanitizePayload([1, 2, 'test'])).toEqual([1, 2, 'test']);
    });
  });

  describe('2. Alert Throttling & Cooldowns', () => {
    let throttler;

    beforeEach(() => {
      throttler = new AlertThrottler();
    });

    it('should allow first alert immediately', () => {
      const { shouldSend, suppressedCount } = throttler.shouldAlert('AUTH_LOGIN_FAILED', 'AUTH_LOGIN_FAILED:user@test.com');
      expect(shouldSend).toBe(true);
      expect(suppressedCount).toBe(0);
    });

    it('should throttle repeated alerts within cooldown window', () => {
      const key = 'AUTH_LOGIN_FAILED:user@test.com';
      throttler.shouldAlert('AUTH_LOGIN_FAILED', key);

      // Second check immediately after
      const second = throttler.shouldAlert('AUTH_LOGIN_FAILED', key);
      expect(second.shouldSend).toBe(false);
      expect(second.suppressedCount).toBe(1);

      // Third check
      const third = throttler.shouldAlert('AUTH_LOGIN_FAILED', key);
      expect(third.shouldSend).toBe(false);
      expect(third.suppressedCount).toBe(2);
    });

    it('should reset cooldown after expiry and report suppressed count', () => {
      const key = 'SECURITY_RATE_LIMIT_HIT:127.0.0.1';
      throttler.shouldAlert('SECURITY_RATE_LIMIT_HIT', key);
      throttler.shouldAlert('SECURITY_RATE_LIMIT_HIT', key);
      throttler.shouldAlert('SECURITY_RATE_LIMIT_HIT', key);

      // Simulate time elapsing past cooldown (e.g. 5 minutes)
      const entry = throttler.history.get(key);
      entry.lastSent = Date.now() - 5 * 60 * 1000;

      const afterExpiry = throttler.shouldAlert('SECURITY_RATE_LIMIT_HIT', key);
      expect(afterExpiry.shouldSend).toBe(true);
      expect(afterExpiry.suppressedCount).toBe(2);
    });

    it('should build throttle keys appropriately for various event types', () => {
      expect(buildThrottleKey('AUTH_LOGIN_FAILED', { email: 'test@a.com' })).toBe('AUTH_LOGIN_FAILED:test@a.com');
      expect(buildThrottleKey('SECURITY_RATE_LIMIT_HIT', { ip: '1.2.3.4' })).toBe('SECURITY_RATE_LIMIT_HIT:1.2.3.4');
      expect(buildThrottleKey('INVENTORY_LOW_STOCK', { productId: 'p123' })).toBe('INVENTORY_LOW_STOCK:p123');
      expect(buildThrottleKey('ORDER_CREATED', { orderId: 'ord_123' })).toBeNull(); // Financial transactions unthrottled
    });
  });

  describe('3. Message Formatter', () => {
    it('should escape HTML tags and quotes to prevent injection', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(escapeHtml('Normal text & symbols')).toBe('Normal text &amp; symbols');
    });

    it('should format order and payment alert messages with details', () => {
      const text = formatAlertMessage('PAYMENT_VERIFIED_SUCCESS', {
        orderId: 'ORD_12345',
        totalPrice: 2499,
        paymentId: 'pay_ABC123',
      });

      expect(text).toContain('PAYMENT VERIFIED');
      expect(text).toContain('ORD_12345');
      expect(text).toContain('2499.00');
      expect(text).toContain('pay_ABC123');
    });

    it('should include suppressed alert banner when count > 0', () => {
      const text = formatAlertMessage('AUTH_LOGIN_FAILED', {
        email: 'attacker@evil.com',
        ip: '192.168.1.100',
      }, { suppressedCount: 5 });

      expect(text).toContain('Suppressed 5 similar events');
    });

    it('should truncate message if length exceeds 4000 characters', () => {
      const largePayload = {
        data: 'A'.repeat(5000),
      };
      const text = formatAlertMessage('SYSTEM_ERROR', largePayload);
      expect(text.length).toBeLessThanOrEqual(4096);
      expect(text).toContain('[Message truncated for Telegram length limit]');
    });
  });

  describe('4. Telegram API Client Resilience', () => {
    let client;
    const originalEnv = { ...process.env };

    beforeEach(() => {
      client = new TelegramClient();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should skip sending if TELEGRAM_NOTIFICATIONS_ENABLED is false', async () => {
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'false';
      const result = await client.sendMessage('Test message');
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('NOTIFICATIONS_DISABLED');
    });

    it('should skip sending if TELEGRAM_CHAT_ID is missing', async () => {
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      delete process.env.TELEGRAM_CHAT_ID;

      const result = await client.sendMessage('Test message');
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('CHAT_ID_NOT_CONFIGURED');
    });

    it('should reject dispatch to an unauthorized chat ID', async () => {
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = '123456789';

      const result = await client.sendMessage('Test message', { chatId: '987654321' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('UNAUTHORIZED_CHAT_DESTINATION');
    });

    it('should dispatch successfully when fetch returns ok', async () => {
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'valid-token';
      process.env.TELEGRAM_CHAT_ID = '123456789';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 999 } }),
      });

      const result = await client.sendMessage('Hello Admin');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(999);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/botvalid-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"chat_id":"123456789"'),
        })
      );
    });

    it('should handle API errors without throwing', async () => {
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED = 'true';
      process.env.TELEGRAM_BOT_TOKEN = 'bad-token';
      process.env.TELEGRAM_CHAT_ID = '123456789';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, description: 'Unauthorized' }),
      });

      const result = await client.sendMessage('Hello');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('5. Central Monitoring Dispatcher & Persistence', () => {
    beforeEach(async () => {
      await MonitoringLog.deleteMany({});
    });

    it('should assign correct severities to critical and security events', () => {
      expect(EVENT_SEVERITIES.SECURITY_INVALID_WEBHOOK_SIGNATURE).toBe('CRITICAL');
      expect(EVENT_SEVERITIES.DB_DISCONNECTED).toBe('CRITICAL');
      expect(EVENT_SEVERITIES.PAYMENT_VERIFIED_SUCCESS).toBe('HIGH');
      expect(EVENT_SEVERITIES.ORDER_CREATED).toBe('MEDIUM');
      expect(EVENT_SEVERITIES.AUTH_REGISTER).toBe('LOW');
    });

    it('should persist monitoring log entries to MongoDB', async () => {
      await notifyMonitoring('ORDER_CREATED', {
        orderId: 'ORD_TEST_99',
        totalPrice: 1499,
        paymentStatus: 'Pending',
      }, { sync: true });

      const logs = await MonitoringLog.find({ eventType: 'ORDER_CREATED' });
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe('ORDER_CREATED');
      expect(logs[0].severity).toBe('MEDIUM');
      expect(logs[0].metadata.orderId).toBe('ORD_TEST_99');
      expect(logs[0].metadata.totalPrice).toBe(1499);
    });

    it('should sanitize metadata before writing to MonitoringLog', async () => {
      await notifyMonitoring('AUTH_LOGIN_FAILED', {
        email: 'admin@cartify.com',
        password: 'AttemptedPassword!',
        ip: '10.0.0.1',
      }, { sync: true });

      const log = await MonitoringLog.findOne({ eventType: 'AUTH_LOGIN_FAILED' });
      expect(log).not.toBeNull();
      expect(log.metadata.password).toBe('[REDACTED]');
      expect(log.metadata.email).toBe('a***n@cartify.com');
    });

    it('should not throw if MongoDB or Telegram client encounters an issue (fail-open)', async () => {
      const invalidPayload = null;
      await expect(
        notifyMonitoring('SYSTEM_ERROR', invalidPayload, { sync: true })
      ).resolves.not.toThrow();
    });
  });
});
