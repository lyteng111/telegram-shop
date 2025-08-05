// This function communicates with the Bakong API to create a payment request.
// It requires your Bakong credentials to be set as environment variables on Netlify.

const fetch = require('node-fetch');
const crypto = require('crypto');

// Helper function to construct the KHQR string
const createKhqrString = (merchantInfo, amount, billNumber) => {
    const formatTag = (id, value) => {
        const len = String(value).length.toString().padStart(2, '0');
        return `${id}${len}${value}`;
    };

    const payloadFormat = formatTag('00', '01');
    const pointOfInitiation = formatTag('01', '12'); // 12 for dynamic QR
    
    const guid = formatTag('00', 'kh.com.nbc.bakong');
    const merchantId = formatTag('01', merchantInfo.id);
    const merchantNameTag = formatTag('02', merchantInfo.name);
    const merchantInfoTag = formatTag('29', `${guid}${merchantId}${merchantNameTag}`);

    const merchantCategoryCode = formatTag('52', '5499');
    const currencyCode = formatTag('53', '840'); // USD
    const amountTag = formatTag('54', amount.toFixed(2));
    const countryCode = formatTag('58', 'KH');
    const merchantCity = formatTag('60', 'Siem Reap');

    const billNumberTag = formatTag('01', billNumber);
    const additionalData = formatTag('62', billNumberTag);

    const combined = `${payloadFormat}${pointOfInitiation}${merchantInfoTag}${merchantCategoryCode}${currencyCode}${amountTag}${countryCode}${merchantCity}${additionalData}6304`;
    
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

    // URL is a built-in Netlify environment variable containing the site's primary URL.
    const { BAKONG_API_TOKEN, BAKONG_MERCHANT_ID, BAKONG_MERCHANT_NAME, URL } = process.env;

    if (!BAKONG_API_TOKEN || !BAKONG_MERCHANT_ID || !BAKONG_MERCHANT_NAME) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Bakong API credentials are not configured on the server.' }) };
    }

    try {
        const { amount, isMobile, billNumber } = JSON.parse(event.body);

        if (!amount || amount <= 0) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Invalid payment amount.' }) };
        }

        const merchantInfo = { id: BAKONG_MERCHANT_ID, name: BAKONG_MERCHANT_NAME };
        const qrCodeString = createKhqrString(merchantInfo, amount, billNumber);
        const md5 = crypto.createHash('md5').update(qrCodeString).digest('hex');

        if (isMobile) {
            const bakongApiUrl = 'https://api-bakong.nbc.gov.kh/v1/generate_deeplink_by_qr';
            
            const apiResponse = await fetch(bakongApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${BAKONG_API_TOKEN}`,
                },
                body: JSON.stringify({
                    qr: qrCodeString,
                    "sourceInfo": {
                        // FIX: Added appName and appIconUrl which are required by the Bakong API for deep-links.
                        "appName": "PsygerHub Shop",
                        "appIconUrl": "https://placehold.co/100x100/7c3aed/ffffff?text=P", // A placeholder icon
                        "appDeepLinkCallback": URL 
                    }
                }),
            });

            // Check if the response is JSON before trying to parse it
            const responseText = await apiResponse.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                // If parsing fails, it means Bakong sent an HTML error page.
                console.error("Bakong API did not return JSON. Response:", responseText);
                throw new Error("Bakong API returned an unexpected response. Please check your API Token.");
            }

            if (result.responseCode !== 0) {
                console.error("Bakong API Error:", result.responseMessage);
                throw new Error(result.responseMessage || 'Failed to generate Bakong deep-link.');
            }

            return {
                statusCode: 200,
                body: JSON.stringify({ deepLink: result.data.shortLink }),
            };

        } else {
            // Desktop flow remains the same
            return {
                statusCode: 200,
                body: JSON.stringify({ qrCode: qrCodeString, md5: md5 }),
            };
        }

    } catch (error) {
        console.error('Bakong API process failed:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Error communicating with Bakong API: ${error.message}` }) };
    }
};
