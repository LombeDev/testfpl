const { schedule } = require('@netlify/functions');
const webpush = require('web-push');

// This function runs every hour
module.exports.handler = schedule('@hourly', async (event) => {
    const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    const data = await response.json();
    
    const nextGW = data.events.find(e => !e.finished && e.is_next);
    const deadlineTime = new Date(nextGW.deadline_time).getTime();
    const now = Date.now();

    // Check if the deadline is between 1 and 2 hours away
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    const oneHourInMs = 1 * 60 * 60 * 1000;
    const diff = deadlineTime - now;

    if (diff > oneHourInMs && diff <= twoHoursInMs) {
        // 1. Get all subscriptions from your database
        const subs = await getAllSubscriptionsFromDB();

        // 2. Send the push to everyone
        const payload = JSON.stringify({
            title: `GW${nextGW.id} Deadline!`,
            body: `Only 2 hours left to save your team. Good luck!`
        });

        subs.forEach(sub => {
            webpush.sendNotification(sub, payload);
        });
    }

    return { statusCode: 200 };
});