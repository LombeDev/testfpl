export default async () => {
    const KEY = process.env.ONESIGNAL_REST_KEY;

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // IMPORTANT: The word 'Basic' followed by a space is REQUIRED
            "Authorization": `Basic ${KEY}`
        },
        body: JSON.stringify({
            app_id: "3d1539b9-d2bd-4690-bd6a-0bd21ed0340b",
            included_segments: ["Total Subscriptions"],
            headings: { en: "Kopala FPL" },
            contents: { en: "Testing 1, 2, 3... can you hear me?" }
        })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), { status: response.status });
};
