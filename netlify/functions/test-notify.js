export default async () => {
    console.log("Attempting to send broadcast...");
    
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${process.env.ONESIGNAL_REST_KEY}`
        },
        body: JSON.stringify({
            app_id: "3d1539b9-d2bd-4690-bd6a-0bd21ed0340b",
            included_segments: ["Total Subscriptions"], 
            headings: { en: "System Check" },
            contents: { en: "Testing Goal Bot Connection..." }
        })
    });

    const result = await response.json();
    console.log("OneSignal Response:", result);

    return new Response(JSON.stringify(result), { 
        status: response.status,
        headers: { "Content-Type": "application/json" }
    });
};
