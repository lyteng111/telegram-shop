// Use dotenv to load environment variables from the .env file
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.PRODUCTION_WEB_APP_URL;

if (!botToken) {
    console.error('FATAL ERROR: TELEGRAM_BOT_TOKEN is not set in your .env file.');
    process.exit(1);
}

if (!webAppUrl) {
    console.error('FATAL ERROR: PRODUCTION_WEB_APP_URL is not set in your .env file.');
    process.exit(1);
}

const bot = new TelegramBot(botToken, { polling: true });

console.log(`✅ Telegram bot started successfully.`);
console.log(`It will point users to the live website: ${webAppUrl}`);
console.log('Go to Telegram and send the /start command to your bot.');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`Received /start command from chat ID: ${chatId}`);

    const welcomeMessage = `🎉 *Welcome to PsygerHub!* 🎉\n\nTap the button below to start browsing our live shop.`;

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🛍️ Open Shop', web_app: { url: webAppUrl } }]
            ]
        },
        parse_mode: 'Markdown'
    };

    bot.sendMessage(chatId, welcomeMessage, opts)
        .then(() => console.log(`Sent welcome message to ${chatId}.`))
        .catch(err => {
            console.error(`Error sending message to ${chatId}:`, err.response ? err.response.body : err.message);
        });
});

bot.on('polling_error', (error) => {
    console.error(`Polling error: ${error.code} - ${error.message}`);
});
