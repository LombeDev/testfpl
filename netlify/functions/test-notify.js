// netlify/functions/test-notify.js
export default async (request) => {
    try {
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Basic ${process.env.ONESIGNAL_REST_KEY}`
            },
            body: JSON.stringify({
                app_id: "3d1539b9-d2bd-4690-bd6a-0bd21ed0340b",
                filters: [
                    { field: "tag", key: "league_id", relation: "=", value: "101712" }
                ],
                headings: { en: "🧪 Test Alert" },
                contents: { en: "Your Kopala FPL Goal Bot is online!" },
                url: "https://kopalafpl.netlify.app"
            })
        });

        const data = await response.json();
        return new Response(JSON.stringify({ status: "Sent", data }), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ status: "Error", message: err.message }), { status: 500 });
    }
};
