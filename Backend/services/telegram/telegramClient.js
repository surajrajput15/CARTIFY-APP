/**
 * Resilient Telegram Bot API Client
 * Enforces strictly private chat ID, non-blocking delivery, bounded retries, and timeouts.
 */

const { logger } = require('../../utils/logger');

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;

class TelegramClient {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
    this.enabled = process.env.TELEGRAM_NOTIFICATIONS_ENABLED === 'true';
  }

  refreshConfig() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
    this.enabled = process.env.TELEGRAM_NOTIFICATIONS_ENABLED === 'true';
  }

  isConfigured() {
    this.refreshConfig();
    return Boolean(this.enabled && this.token && this.chatId);
  }

  /**
   * Send a message to the configured private Telegram chat.
   * Strictly verifies destination chat ID against process.env.TELEGRAM_CHAT_ID.
   * 
   * @param {string} text HTML-formatted message text
   * @param {object} options Optional delivery settings
   * @returns {Promise<{ success: boolean, messageId?: number, error?: string, skipped?: boolean }>}
   */
  async sendMessage(text, options = {}) {
    this.refreshConfig();

    if (!this.enabled) {
      return { success: false, skipped: true, reason: 'NOTIFICATIONS_DISABLED' };
    }

    if (!this.token) {
      return { success: false, skipped: true, reason: 'TOKEN_NOT_CONFIGURED' };
    }

    if (!this.chatId) {
      logger.warn('Telegram notification skipped: TELEGRAM_CHAT_ID is not configured in environment');
      return { success: false, skipped: true, reason: 'CHAT_ID_NOT_CONFIGURED' };
    }

    // Safety guard: Destination must match configured private chat ID
    const targetChatId = String(options.chatId || this.chatId).trim();
    if (targetChatId !== String(this.chatId).trim()) {
      logger.error('Security alert: Attempted to send Telegram notification to unconfigured chat ID');
      return { success: false, error: 'UNAUTHORIZED_CHAT_DESTINATION' };
    }

    const url = `${TELEGRAM_API_BASE}/bot${this.token}/sendMessage`;
    const payload = {
      chat_id: targetChatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options.telegramParams,
    };

    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (response.ok && data.ok) {
          return { success: true, messageId: data.result?.message_id };
        }

        // Check if retryable (429 or 5xx)
        const isRetryable = response.status === 429 || response.status >= 500;
        if (!isRetryable || attempt > MAX_RETRIES) {
          logger.error({ status: response.status, data }, 'Telegram API error response');
          return {
            success: false,
            error: data.description || `HTTP ${response.status}`,
            statusCode: response.status,
          };
        }

        // Wait with backoff before retry (500ms * attempt)
        await new Promise((r) => setTimeout(r, 500 * attempt));
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = err.name === 'AbortError' || err.message === 'The user aborted a request.';
        const errorMsg = isAbort ? 'Telegram API request timeout (5s)' : err.message;

        if (attempt > MAX_RETRIES) {
          logger.error({ err: errorMsg }, 'Telegram delivery failed after max retries');
          return { success: false, error: errorMsg };
        }

        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }

    return { success: false, error: 'RETRY_EXHAUSTED' };
  }

  /**
   * Verify bot identity via getMe
   */
  async getMe() {
    this.refreshConfig();
    if (!this.token) throw new Error('TELEGRAM_BOT_TOKEN not configured');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${this.token}/getMe`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Fetch recent updates via getUpdates (used by verification script to identify chat ID)
   */
  async getUpdates() {
    this.refreshConfig();
    if (!this.token) throw new Error('TELEGRAM_BOT_TOKEN not configured');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${this.token}/getUpdates`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

const telegramClient = new TelegramClient();

module.exports = {
  TelegramClient,
  telegramClient,
};
