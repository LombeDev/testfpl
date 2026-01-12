export const handler = async (event, context) => {
  const FPL_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';

  try {
    const response = await fetch(FPL_URL, {
      headers: {
        'User-Agent': 'MyFPLApp/1.0', // Helps avoid 403 blocks
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `FPL API returned ${response.status}` }),
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // This allows your frontend to talk to your function
        "Access-Control-Allow-Origin": "*", 
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch data" }),
    };
  }
};
