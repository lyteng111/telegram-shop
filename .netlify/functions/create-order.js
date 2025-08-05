const TelegramBot = require('node-telegram-bot-api');
const { parse } = require('querystring-es3');

exports.handler = async (event) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !adminChatId) {
        console.error('FATAL ERROR: Telegram environment variables are not set on Netlify.');
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Configuration Error.' }),
        };
    }

    const bot = new TelegramBot(botToken);

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
        };
    }

    try {
        const orderDetails = JSON.parse(event.body);
        const { customerInfo, items, total, deliveryMethod, paymentMethod, telegramInitData } = orderDetails;

        const orderId = `ORD-${Date.now()}`;
        let customerTelegramUserId = null;
        let customerUsername = 'N/A';
        let customerFirstName = 'Customer';

        if (telegramInitData) {
            try {
                const parsedInitData = parse(telegramInitData);
                if (parsedInitData.user) {
                    const user = JSON.parse(parsedInitData.user);
                    customerTelegramUserId = user.id;
                    customerUsername = user.username || 'N/A';
                    customerFirstName = user.first_name || 'Customer';
                }
            } catch (parseError) {
                console.error('Could not parse telegramInitData:', parseError);
            }
        }

        const formatDeliveryMethod = (method) => ({'in_siem_reap': 'In Siem Reap', 'virak_buntham': 'Virak Buntham', 'j_and_t': 'J&T Express'}[method] || method);
        const formatPaymentMethod = (method) => ({'cash_on_delivery': 'Cash on Delivery', 'aba_bank': 'ABA Bank Transfer'}[method] || method);

        let adminMessage = `🚀 *New Order Received!* 🚀\n\n` +
                           `*Order ID:* \`${orderId}\`\n` +
                           `*Customer:* ${customerInfo.name}\n` +
                           `*Phone:* \`${customerInfo.phone}\`\n` +
                           `*Address:* ${customerInfo.address}\n` +
                           (customerTelegramUserId ? `*Telegram ID:* \`${customerTelegramUserId}\` (@${customerUsername})\n` : '') +
                           `*Delivery:* ${formatDeliveryMethod(deliveryMethod)}\n` +
                           `*Payment:* ${formatPaymentMethod(paymentMethod)}\n\n` +
                           `*Items:*\n` +
                           items.map(item => `- ${item.name} x ${item.quantity} ($${item.price.toFixed(2)})`).join('\n') +
                           `\n\n*Total:* \`$${total.toFixed(2)}\``;

        await bot.sendMessage(adminChatId, adminMessage, { parse_mode: 'Markdown' });

        if (customerTelegramUserId) {
            let userInvoiceMessage = `🧾 *Your Order Confirmation* 🧾\n\n` +
                                     `Hello ${customerFirstName}, your order (#\`${orderId}\`) is confirmed.\n\n` +
                                     `*Summary:*\n` +
                                     items.map(item => `- ${item.name} x ${item.quantity} ($${item.price.toFixed(2)})`).join('\n') +
                                     `\n\n*Total:* \`$${total.toFixed(2)}\`\n` +
                                     `*Payment:* ${formatPaymentMethod(paymentMethod)}\n` +
                                     `*Delivery Address:* ${customerInfo.address}\n\n` +
                                     `We will contact you shortly. Thank you!`;

            if (paymentMethod === 'aba_bank') {
                userInvoiceMessage += `\n\n*Important:* For ABA, please send a transaction screenshot to this chat.`;
            }
            await bot.sendMessage(customerTelegramUserId, userInvoiceMessage, { parse_mode: 'Markdown' });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Order received!', orderId }),
        };

    } catch (error) {
        console.error('Error processing order:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to process order.', error: error.message }),
        };
    }
};
