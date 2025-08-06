// This function contains the final fix for the Bakong Merchant ID.

const fetch = require('node-fetch');
const crypto = require('crypto');

// Standard CRC-16/CCITT-FALSE checksum function used by KHQR
const crc16 = (data) => {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

const createKhqrString = (merchantInfo, amount, billNumber) => {
    const formatTag = (id, value) => {
        const valueStr = String(value);
        const len = valueStr.length.toString().padStart(2, '0');
        return `${id}${len}${valueStr}`;
    };

    const payloadFormat = formatTag('00', '01');
    const pointOfInitiation = formatTag('01', '12');
    const guid = formatTag('00', 'kh.com.nbc.bakong');
    const merchantId = formatTag('01', merchantInfo.id);
    const merchantNameTag = formatTag('02', merchantInfo.name);
    const merchantInfoTag = formatTag('29', `${guid}${merchantId}${merchantNameTag}`);
    const merchantCategoryCode = formatTag('52', '5499');
    const currencyCode = formatTag('53', '840');
    const amountTag = formatTag('54', amount.toFixed(2));
    const countryCode = formatTag('58', 'KH');
    const merchantCity = formatTag('60', 'Siem Reap');
    const billNumberTag = formatTag('01', billNumber);
    const additionalData = formatTag('62', billNumberTag);
    const dataToChecksum = `${payloadFormat}${pointOfInitiation}${merchantInfoTag}${merchantCategoryCode}${currencyCode}${amountTag}${countryCode}${merchantCity}${additionalData}6304`;
    const checksum = crc16(dataToChecksum);
    return `${dataToChecksum}${checksum}`;
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { BAKONG_API_TOKEN, BAKONG_MERCHANT_ID, BAKONG_MERCHANT_NAME, URL } = process.env;

    if (!BAKONG_API_TOKEN || !BAKONG_MERCHANT_ID || !BAKONG_MERCHANT_NAME) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Bakong API credentials are not configured on the server.' }) };
    }

    // --- FINAL FIX IS HERE ---
    // This code checks if the merchant ID ends with the unofficial '@aclb'
    // and replaces it with the official '@acledabank' for universal compatibility.
    let correctedMerchantId = BAKONG_MERCHANT_ID;
    if (correctedMerchantId.endsWith('@aclb')) {
        correctedMerchantId = correctedMerchantId.replace('@aclb', '@acledabank');
        console.log(`Corrected ACLEDA merchant ID to: ${correctedMerchantId}`);
    }
    // --- END OF FIX ---

    try {
        const { amount, isMobile, billNumber } = JSON.parse(event.body);
        if (!amount || amount <= 0) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Invalid payment amount.' }) };
        }

        const merchantInfo = { id: correctedMerchantId, name: BAKONG_MERCHANT_NAME };
        const qrCodeString = createKhqrString(merchantInfo, amount, billNumber);
        const md5 = crypto.createHash('md5').update(qrCodeString).digest('hex');

        if (isMobile) {
            const bakongApiUrl = 'https://api-bakong.nbc.gov.kh/v1/generate_deeplink_by_qr';
            const apiResponse = await fetch(bakongApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BAKONG_API_TOKEN}` },
                body: JSON.stringify({
                    qr: qrCodeString,
                    "sourceInfo": {
                        "appName": "PsygerHub Shop",
                        "appIconUrl": "https://placehold.co/100x100/7c3aed/ffffff?text=P",
                        "appDeepLinkCallback": URL
                    }
                }),
            });

            const responseText = await apiResponse.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error("Bakong API did not return valid JSON. Response:", responseText);
                throw new Error("Bakong API returned an unexpected response. Please check your API Token and Merchant ID.");
            }

            if (result.responseCode !== 0) {
                console.error("Bakong API returned an error:", result.responseMessage);
                throw new Error(result.responseMessage || 'Failed to generate Bakong deep-link.');
            }

            return {
                statusCode: 200,
                body: JSON.stringify({ deepLink: result.data.shortLink }),
            };

        } else {
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
