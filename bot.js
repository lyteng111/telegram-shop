// Use dotenv to load environment variables from the .env file
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

// Get the bot token and the production web app URL from the .env file
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.PRODUCTION_WEB_APP_URL;

if (!botToken) {
    console.error('FATAL ERROR: TELEGRAM_BOT_TOKEN is not set in your .env file.');
    process.exit(1);
}

if (!webAppUrl) {
    console.error('FATAL ERROR: PRODUCTION_WEB_APP_URL is not set in your .env file.');
    console.error('Please deploy your site to Netlify and add the URL to your .env file.');
    process.exit(1);
}

// Create a bot that uses 'polling' to fetch new updates from Telegram
const bot = new TelegramBot(botToken, { polling: true });

console.log(`✅ Telegram bot started successfully.`);
console.log(`It will point users to the live website: ${webAppUrl}`);
console.log('Go to Telegram and send the /start command to your bot.');

// Listen for the /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`Received /start command from chat ID: ${chatId}`);

    const welcomeMessage = `🎉 *Welcome to PsygerHub!* 🎉\n\nTap the button below to start browsing our live shop.`;

    // Create an inline keyboard with a button that opens your live web app
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

// Handle polling errors to prevent the bot from crashing
bot.on('polling_error', (error) => {
    console.error(`Polling error: ${error.code} - ${error.message}`);
});
