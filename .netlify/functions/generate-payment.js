// This function communicates with the Bakong API to create a payment request.
// It requires your Bakong credentials to be set as environment variables on Netlify.

const fetch = require('node-fetch');
const crypto = require('crypto');

// Helper function to construct the KHQR string
// This is based on the official Bakong/KHQR documentation standards.
const createKhqrString = (merchantInfo, amount, billNumber) => {
    const formatTag = (id, value) => {
        const len = String(value).length.toString().padStart(2, '0');
        return `${id}${len}${value}`;
    };

    // Static parts of the QR string
    const payloadFormat = formatTag('00', '01');
    const pointOfInitiation = formatTag('01', '12'); // 12 for dynamic QR
    
    // Merchant Information (Tag 29 for Bakong)
    const guid = formatTag('00', 'kh.com.nbc.bakong');
    const merchantId = formatTag('01', merchantInfo.id); // Your Bakong Account ID
    const merchantNameTag = formatTag('02', merchantInfo.name);
    const merchantInfoTag = formatTag('29', `${guid}${merchantId}${merchantNameTag}`);

    const merchantCategoryCode = formatTag('52', '5499'); // General Retail
    const currencyCode = formatTag('53', '840'); // 840 for USD
    const amountTag = formatTag('54', amount.toFixed(2));
    const countryCode = formatTag('58', 'KH');
    const merchantCity = formatTag('60', 'Siem Reap');

    // Additional Data (Tag 62) for Bill Number
    const billNumberTag = formatTag('01', billNumber);
    const additionalData = formatTag('62', billNumberTag);

    // Combine all parts
    const combined = `${payloadFormat}${pointOfInitiation}${merchantInfoTag}${merchantCategoryCode}${currencyCode}${amountTag}${countryCode}${merchantCity}${additionalData}6304`;
    
    // Calculate CRC checksum
    // This is a standard algorithm for QR codes
    let crc = 0xFFFF;
    for (let i = 0; i < combined.length; i++) {
        crc ^= combined.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        }
    }
    const crcChecksum = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

    return `${combined}${crcChecksum}`;
};


exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { BAKONG_API_TOKEN, BAKONG_MERCHANT_ID, BAKONG_MERCHANT_NAME } = process.env;

    if (!BAKONG_API_TOKEN || !BAKONG_MERCHANT_ID || !BAKONG_MERCHANT_NAME) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Bakong API credentials are not configured on the server.' }) };
    }

    try {
        const { amount, isMobile, billNumber } = JSON.parse(event.body);

        if (!amount || amount <= 0) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Invalid payment amount.' }) };
        }

        const merchantInfo = {
            id: BAKONG_MERCHANT_ID,
            name: BAKONG_MERCHANT_NAME,
        };

        // 1. Generate the KHQR string
        const qrCodeString = createKhqrString(merchantInfo, amount, billNumber);

        // 2. Create an MD5 hash of the QR string to check payment status later
        const md5 = crypto.createHash('md5').update(qrCodeString).digest('hex');

        // 3. Handle mobile vs. desktop
        if (isMobile) {
            // For mobile, we need to get a deep-link from the Bakong API
            const bakongApiUrl = 'https://api-bakong.nbc.gov.kh/v1/generate_deeplink_by_qr';
            
            const response = await fetch(bakongApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${BAKONG_API_TOKEN}`,
                },
                body: JSON.stringify({
                    qr: qrCodeString,
                    // The callback is where the user is sent after payment.
                    // IMPORTANT: You might need to create a specific "thank you" page on your site.
                    "sourceInfo": {
                        "appDeepLinkCallback": "https://your-site-name.netlify.app/" // Replace with your site URL
                    }
                }),
            });

            const result = await response.json();
            if (result.responseCode !== 0) {
                throw new Error(result.responseMessage || 'Failed to generate Bakong deep-link.');
            }

            return {
                statusCode: 200,
                body: JSON.stringify({ deepLink: result.data.shortLink }),
            };

        } else {
            // For desktop, we just return the QR string and the MD5 hash
            return {
                statusCode: 200,
                body: JSON.stringify({ qrCode: qrCodeString, md5: md5 }),
            };
        }

    } catch (error) {
        console.error('Bakong API Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Error communicating with Bakong API: ${error.message}` }) };
    }
};
