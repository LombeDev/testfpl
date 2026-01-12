import { getStore } from "@netlify/blobs";
const webpush = require('web-push');

export default async () => {
  const store = getStore("fpl-managers");
  const allManagers = await store.list(); // Gets list of all saved FPL IDs

  // Fetch Live FPL Data
  const res = await fetch('https://fantasy.premierleague.com/api/event/20/live/');
  const data = await res.json();
  const scorers = data.elements.filter(el => el.stats.goals_scored > 0).map(el => el.id);

  // Loop through your Blobs
  for (const key of allManagers.blobs) {
    const subscription = await store.getJSON(key.key);
    
    // Logic: If manager's player is in 'scorers', send push...
    webpush.sendNotification(subscription, "⚽ Your player scored!");
  }
};
