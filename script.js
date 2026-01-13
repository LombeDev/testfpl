// script.js

// Replace the old PROXY and BASE_URL logic with this:
const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";

async function init() {
    try {
        // Example: Instead of https://fantasy.../api/bootstrap-static/
        // We call: /.netlify/functions/fpl-proxy?endpoint=bootstrap-static/
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        
        allPlayers = data.elements;
        const activeEvent = data.events.find(e => e.is_current);
        if (activeEvent) currentGW = activeEvent.id;
    } catch (e) {
        console.error("Initialization failed via Netlify Function.");
    }
}

// Apply this same logic to all your other fetch calls:
// changeLeague: `${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`
// loadPitchView: `${PROXY_ENDPOINT}entry/${managerId}/event/${currentGW}/picks/`
// fetchLivePoints: `${PROXY_ENDPOINT}event/${currentGW}/live/`
