const TelegramBot = require('node-telegram-bot-api');
const { parse } = require('querystring-es3');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, ABA_PAYMENT_LINK } = process.env;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Telegram credentials are not configured.' }) };
    }

    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

    try {
        const orderDetails = JSON.parse(event.body);
        const { customerInfo, items, total, deliveryMethod, paymentMethod } = orderDetails;

        const orderId = `ORD-${Date.now()}`;
        let customerUsername = 'N/A';

        if (orderDetails.telegramInitData) {
            try {
                const user = JSON.parse(parse(orderDetails.telegramInitData).user);
                customerUsername = user.username || 'N/A';
            } catch (e) { console.error('Could not parse telegramInitData:', e); }
        }

        const formatDeliveryMethod = (method) => ({'in_siem_reap': 'In Siem Reap', 'virak_buntham': 'Virak Buntham', 'j_and_t': 'J&T Express'}[method] || method);
        const formatPaymentMethod = (method) => ({'cash_on_delivery': 'Cash on Delivery', 'aba_payment_link': 'ABA Payment Link'}[method] || method);

        let adminMessageTitle = paymentMethod === 'cash_on_delivery' ? '✅ *New Confirmed Order!* ✅' : '🟡 *New Pending Order!* 🟡';
        let adminMessageAction = paymentMethod === 'cash_on_delivery' 
            ? '*Action:* This is a Cash on Delivery order. Please prepare for delivery.'
            : '*Action:* Please wait for the customer to send a payment screenshot to confirm this order.';

        let adminMessage = `${adminMessageTitle}\n\n` +
                           `*Order ID:* \`${orderId}\`\n` +
                           `*Customer:* ${customerInfo.name} (@${customerUsername})\n` +
                           `*Phone:* \`${customerInfo.phone}\`\n` +
                           `*Address:* ${customerInfo.address}\`\n` +
                           `*Delivery:* ${formatDeliveryMethod(deliveryMethod)}\n` +
                           `*Payment:* ${formatPaymentMethod(paymentMethod)}\n\n` +
                           `*Items:*\n` +
                           items.map(item => `- ${item.name} x ${item.quantity} ($${item.price.toFixed(2)})`).join('\n') +
                           `\n\n*Total:* \`$${total.toFixed(2)}\`\n\n` +
                           `${adminMessageAction}`;

        await bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, adminMessage, { parse_mode: 'Markdown' });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Order notification sent.',
                paymentLink: ABA_PAYMENT_LINK 
            }),
        };

    } catch (error) {
        console.error('Error processing order:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Failed to process order.' }) };
    }
};
