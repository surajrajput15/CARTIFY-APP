/**
 * Alert Throttler / Cooldown Manager
 * Prevents alert flooding and Telegram rate-limit exhaustion.
 */

class AlertThrottler {
  constructor() {
    this.history = new Map(); // key -> { count: number, lastSent: number, aggregated: number }
    this.defaultCooldowns = {
      AUTH_LOGIN_FAILED: 60 * 1000,          // 1 minute per identity/ip
      AUTH_LOCKOUT: 2 * 60 * 1000,            // 2 minutes
      SECURITY_RATE_LIMIT_HIT: 3 * 60 * 1000, // 3 minutes per ip
      SECURITY_UNAUTHORIZED_ADMIN: 60 * 1000, // 1 minute
      DB_DISCONNECTED: 5 * 60 * 1000,         // 5 minutes
      SYSTEM_ERROR: 2 * 60 * 1000,            // 2 minutes per error fingerprint
      INVENTORY_LOW_STOCK: 15 * 60 * 1000,    // 15 minutes per product
    };

    // Periodic sweep to prevent unbounded memory usage on floods
    this.cleanupInterval = setInterval(() => this.prune(), 10 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Determine if an alert should be throttled.
   * @param {string} eventType 
   * @param {string} throttleKey e.g. "AUTH_LOGIN_FAILED:user@example.com" or "SYSTEM_ERROR:CastError"
   * @returns {{ shouldSend: boolean, suppressedCount: number }}
   */
  shouldAlert(eventType, throttleKey) {
    const cooldownMs = this.defaultCooldowns[eventType];
    if (!cooldownMs || !throttleKey) {
      return { shouldSend: true, suppressedCount: 0 };
    }

    const now = Date.now();
    const entry = this.history.get(throttleKey);

    if (!entry) {
      this.history.set(throttleKey, { lastSent: now, suppressed: 0 });
      return { shouldSend: true, suppressedCount: 0 };
    }

    if (now - entry.lastSent >= cooldownMs) {
      const suppressed = entry.suppressed;
      entry.lastSent = now;
      entry.suppressed = 0;
      return { shouldSend: true, suppressedCount: suppressed };
    }

    // Still in cooldown: suppress and increment count
    entry.suppressed += 1;
    return { shouldSend: false, suppressedCount: entry.suppressed };
  }

  /**
   * Reset throttling history (useful for tests)
   */
  reset() {
    this.history.clear();
  }

  /**
   * Prune entries older than 30 minutes
   */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.history.entries()) {
      if (now - entry.lastSent > 30 * 60 * 1000) {
        this.history.delete(key);
      }
    }
  }
}

const alertThrottler = new AlertThrottler();

module.exports = {
  AlertThrottler,
  alertThrottler,
};
