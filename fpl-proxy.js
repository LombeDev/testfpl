// netlify/functions/fpl-proxy.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
    try {
        const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Allows your frontend to access it
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed fetching FPL data' })
        };
    }
}
