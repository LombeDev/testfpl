self.addEventListener('message', (event) => {
    if (event.data.type === 'SCHEDULE_DEADLINE') {
        const deadline = new Date(event.data.deadline).getTime();
        const notifyTime = deadline - (2 * 60 * 60 * 1000); // T-minus 2 hours
        const now = Date.now();
        const delay = notifyTime - now;

        if (delay > 0) {
            // Clear any old timers if they exist
            if (self.deadlineTimeout) clearTimeout(self.deadlineTimeout);

            self.deadlineTimeout = setTimeout(() => {
                self.registration.showNotification('KOPALA FPL', {
                    body: `Gameweek ${event.data.gw} deadline is in 2 hours! Finalize your team.`,
                    icon: '/icon.png', // Ensure this path is correct
                    badge: '/icon.png',
                    vibrate: [200, 100, 200],
                    tag: 'deadline-alert',
                    requireInteraction: true
                });
            }, delay);
        }
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/team.html'));
});
