/**
 * Telegram Bot Verification & Diagnostics Utility
 * 
 * Usage:
 *   node scripts/verifyTelegramBot.js
 * 
 * Functions:
 * 1. Verifies TELEGRAM_BOT_TOKEN with Telegram's getMe API
 * 2. If TELEGRAM_CHAT_ID is missing, scans getUpdates for recent /start messages to display your chat ID
 * 3. If TELEGRAM_CHAT_ID is present, sends a verified test alert to confirm end-to-end delivery
 */

require('dotenv').config();
const { telegramClient } = require('../services/telegram/telegramClient');

async function runVerification() {
  console.log('====================================================');
  console.log('🤖 CARTIFY — TELEGRAM MONITORING BOT VERIFICATION');
  console.log('====================================================\n');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const enabled = process.env.TELEGRAM_NOTIFICATIONS_ENABLED;

  console.log(`Config Status:`);
  console.log(`- TELEGRAM_NOTIFICATIONS_ENABLED: ${enabled || 'false'}`);
  console.log(`- TELEGRAM_BOT_TOKEN: ${token ? 'Configured (starts with ' + token.slice(0, 10) + '...)' : 'MISSING'}`);
  console.log(`- TELEGRAM_CHAT_ID: ${chatId || 'NOT CONFIGURED YET'}\n`);

  if (!token) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN is missing in Backend/.env');
    process.exit(1);
  }

  // Step 1: Verify Bot Token
  console.log('Step 1: Connecting to Telegram API to verify Bot Token...');
  try {
    const me = await telegramClient.getMe();
    if (!me.ok) {
      console.error(`❌ Bot Token Invalid: ${me.description}`);
      process.exit(1);
    }
    console.log(`✅ Bot Token Valid! Connected as:`);
    console.log(`   - Name: ${me.result.first_name}`);
    console.log(`   - Username: @${me.result.username}`);
    console.log(`   - Bot ID: ${me.result.id}\n`);
  } catch (err) {
    console.error(`❌ Connection failed: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Handle Chat ID
  if (!chatId) {
    console.log('Step 2: Checking for recent messages to detect your Chat ID...');
    try {
      const updates = await telegramClient.getUpdates();
      const messages = updates.result || [];

      if (messages.length === 0) {
        console.log('\n⚠️  No incoming messages found yet.');
        console.log('👉 Please follow these simple steps to link your private chat:');
        console.log('   1. Open Telegram on your phone or web.');
        console.log('   2. Open the bot: https://t.me/CartifyAlerts_Bot (or search @CartifyAlerts_Bot).');
        console.log('   3. Tap "START" or send "/start" message to the bot.');
        console.log('   4. Run this script again: node scripts/verifyTelegramBot.js\n');
        return;
      }

      // Find the latest private message
      const latest = messages[messages.length - 1];
      const chat = latest.message?.chat || latest.channel_post?.chat;

      if (chat && chat.id) {
        console.log(`\n🎉 Found your chat!`);
        console.log(`   - Chat ID: ${chat.id}`);
        console.log(`   - Name: ${chat.first_name || ''} ${chat.last_name || ''} (${chat.username ? '@' + chat.username : 'No username'})`);
        console.log(`   - Type: ${chat.type}`);
        console.log('\n👉 Next Step:');
        console.log(`   Add this line to your Backend/.env:`);
        console.log(`   TELEGRAM_CHAT_ID=${chat.id}`);
        console.log(`   TELEGRAM_NOTIFICATIONS_ENABLED=true\n`);
        console.log('Then run this script again to send a test alert!\n');
      } else {
        console.log('⚠️ Could not extract chat ID from recent updates. Send /start to the bot and retry.');
      }
    } catch (err) {
      console.error(`❌ Error fetching updates: ${err.message}`);
    }
    return;
  }

  // Step 3: Test Alert Delivery
  console.log(`Step 3: Sending Test Alert to configured chat ID: ${chatId}...`);
  const testMessage = [
    '🔔 <b>CARTIFY MONITORING SYSTEM ACTIVATED</b>',
    '✅ <b>Status:</b> Telegram private monitoring channel verified successfully!',
    `🕒 <b>Time:</b> <code>${new Date().toISOString()}</code>`,
    '🛡️ <b>Environment:</b> ' + (process.env.NODE_ENV || 'development'),
    '🔒 <i>All customer and admin alerts will now be routed here in real-time.</i>',
  ].join('\n');

  try {
    const res = await telegramClient.sendMessage(testMessage);
    if (res.success) {
      console.log(`\n🎉 SUCCESS! Test alert delivered to your Telegram.`);
      console.log(`   Message ID: ${res.messageId}`);
      console.log('\nYour Cartify Telegram Monitoring System is 100% operational!\n');
    } else {
      console.error(`\n❌ Failed to send alert: ${res.error || res.reason}`);
      if (res.error && res.error.includes('chat not found')) {
        console.error('👉 Make sure you have started a chat with @CartifyAlerts_Bot (send /start).');
      }
    }
  } catch (err) {
    console.error(`\n❌ Unexpected error: ${err.message}`);
  }
}

runVerification();
