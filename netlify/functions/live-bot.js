import { getStore } from "@netlify/blobs";

export default async () => {
    const store = getStore("fpl-goal-memory");

    // 1. Fetch Live Data
    const [liveRes, staticRes] = await Promise.all([
        fetch('https://fantasy.premierleague.com/api/event/20/live/'),
        fetch('https://fantasy.premierleague.com/api/bootstrap-static/')
    ]);
    const liveData = await liveRes.json();
    const staticData = await staticRes.json();

    // 2. Check for new goals
    for (const player of liveData.elements) {
        if (player.stats.goals_scored > 0) {
            const pId = player.id.toString();
            const savedGoals = await store.get(pId) || "0";

            if (player.stats.goals_scored > parseInt(savedGoals)) {
                const pInfo = staticData.elements.find(el => el.id === player.id);
                
                // 3. Send Notification to League 101712
                await fetch("https://onesignal.com/api/v1/notifications", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Basic ${process.env.ONESIGNAL_REST_KEY}`
                    },
                    body: JSON.stringify({
                        app_id: "3d1539b9-d2bd-4690-bd6a-0bd21ed0340b",
                        filters: [{ field: "tag", key: "league_id", relation: "=", value: "101712" }],
                        headings: { en: "⚽ GOAL!" },
                        contents: { en: `${pInfo.web_name} just scored in your league!` }
                    })
                });

                // Update memory
                await store.set(pId, player.stats.goals_scored.toString());
            }
        }
    }
};

export const config = { schedule: "* * * * *" };
