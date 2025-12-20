const axios = require('axios'); // You may need to run 'npm install axios'

exports.handler = async function(event, context) {
    try {
        const response = await axios.get('https://fantasy.premierleague.com/api/event/current/live/');
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // This allows your frontend to see the data
                "Content-Type": "application/json"
            },
            body: JSON.stringify(response.data)
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};
