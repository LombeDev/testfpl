const axios = require('axios');

exports.handler = async (event, context) => {
    const { path } = event.queryStringParameters;
    const url = `https://fantasy.premierleague.com/api/${path}/`;

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
            },
        });

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(response.data),
        };
    } catch (error) {
        return {
            statusCode: error.response ? error.response.status : 500,
            body: JSON.stringify({ error: "Failed to fetch FPL data" }),
        };
    }
};