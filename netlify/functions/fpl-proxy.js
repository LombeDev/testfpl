// netlify/functions/fpl-proxy.js
const fetch = require('node-fetch'); // Netlify includes this by default

exports.handler = async function (event, context) {
  // We get the endpoint from the query string (e.g., ?endpoint=bootstrap-static/)
  const endpoint = event.queryStringParameters.endpoint;
  const url = `https://fantasy.premierleague.com/api/${endpoint}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Allows your site to talk to this function
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};
