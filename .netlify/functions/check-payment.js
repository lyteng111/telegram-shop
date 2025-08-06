const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { BAKONG_API_TOKEN } = process.env;
    if (!BAKONG_API_TOKEN) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Bakong API token is not configured.' }) };
    }

    try {
        const { md5 } = JSON.parse(event.body);
        if (!md5) {
            return { statusCode: 400, body: JSON.stringify({ message: 'MD5 hash is required.' }) };
        }

        const bakongApiUrl = 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';

        const response = await fetch(bakongApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BAKONG_API_TOKEN}`,
            },
            body: JSON.stringify({ md5 }),
        });

        const result = await response.json();

        if (result.responseCode === 0 && result.data && result.data.hash) {
            return {
                statusCode: 200,
                body: JSON.stringify({ status: 'PAID' }),
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify({ status: 'UNPAID' }),
            };
        }

    } catch (error) {
        console.error('Error checking Bakong payment status:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Failed to check payment status.' }) };
    }
};
