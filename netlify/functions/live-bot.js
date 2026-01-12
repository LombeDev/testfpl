// netlify/functions/goal-bot.js
import { getStore } from "@netlify/blobs";

export default async () => {
    const store = getStore("fpl-live-memory");

    const [liveRes, staticRes] = await Promise.all([
        fetch('https://fantasy.premierleague.com/api/event/20/live/'),
        fetch('https://fantasy.premierleague.com/api/bootstrap-static/')
    ]);
    const liveData = await liveRes.json();
    const staticData = await staticRes.json();

    for (const player of liveData.elements) {
        const pId = player.id.toString();
        const pInfo = staticData.elements.find(el => el.id === player.id);
        
        // Grab current live stats
        const currentGoals = player.stats.goals_scored || 0;
        const currentAssists = player.stats.assists || 0;

        // Grab what we "remembered" from the last minute
        const memory = await store.getJSON(pId) || { goals: 0, assists: 0 };

        let message = "";

        // CHECK FOR GOALS
        if (currentGoals > memory.goals) {
            message = `⚽ GOAL! ${pInfo.web_name} has scored!`;
        } 
        // CHECK FOR ASSISTS
        else if (currentAssists > memory.assists) {
            message = `🎯 ASSIST! ${pInfo.web_name} with the setup!`;
        }

        if (message) {
            // Send to OneSignal
            await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Basic ${process.env.ONESIGNAL_REST_KEY}`
                },
                body: JSON.stringify({
                    app_id: "3d1539b9-d2bd-4690-bd6a-0bd21ed0340b",
                    filters: [{ field: "tag", key: "league_id", relation: "=", value: "101712" }],
                    headings: { en: "FPL Live Alert" },
                    contents: { en: message }
                })
            });

            // Update memory so we don't alert the same event twice
            await store.setJSON(pId, { goals: currentGoals, assists: currentAssists });
        }
    }
};

export const config = { schedule: "* * * * *" };
