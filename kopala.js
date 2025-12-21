// Backup Proxies
const proxies = [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?",
    "https://thingproxy.freeboard.io/fetch/"
];

const LEAGUE_ID = "101712";

async function fetchWithRetry(url) {
    for (let proxy of proxies) {
        try {
            const response = await fetch(proxy + encodeURIComponent(url));
            if (response.ok) return await response.json();
        } catch (e) {
            console.warn(`Proxy failed: ${proxy}`);
        }
    }
    throw new Error("All proxies failed");
}

async function fetchProLeague() {
    const body = document.getElementById("league-body");
    const loader = document.getElementById("loading-overlay");
    const errorDiv = document.getElementById("error-msg");
    
    loader.classList.remove("hidden");
    errorDiv.classList.add("hidden");

    try {
        // 1. Get Game Data
        const staticData = await fetchWithRetry("https://fantasy.premierleague.com/api/bootstrap-static/");
        const players = {};
        staticData.elements.forEach(p => players[p.id] = p.web_name);
        const curGW = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${curGW}`;

        // 2. Get Standings
        const leagueData = await fetchWithRetry(`https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/`);
        const managers = leagueData.standings.results;

        if (!managers || managers.length === 0) {
            throw new Error("League empty or not found.");
        }

        // 3. Deep Fetch History & Picks
        const detailed = await Promise.all(managers.slice(0, 50).map(async (m) => {
            try {
                const [h, p] = await Promise.all([
                    fetchWithRetry(`https://fantasy.premierleague.com/api/entry/${m.entry}/history/`),
                    fetchWithRetry(`https://fantasy.premierleague.com/api/entry/${m.entry}/event/${curGW}/picks/`)
                ]);
                
                const lastH = h.current[h.current.length - 1];
                const chip = h.chips.find(c => c.event === curGW);
                const cap = p.picks.find(pk => pk.is_captain);

                return {
                    ...m,
                    ovr: lastH.overall_rank.toLocaleString(),
                    chip: chip ? chip.name : null,
                    capName: players[cap.element]
                };
            } catch {
                return { ...m, ovr: "N/A", chip: null, capName: "???" };
            }
        }));

        renderTable(detailed);
        loader.classList.add("hidden");
    } catch (err) {
        console.error(err);
        loader.classList.add("hidden");
        errorDiv.textContent = "Data Error: FPL API is currently restricted via proxy. Try again in 1 minute.";
        errorDiv.classList.remove("hidden");
    }
}

function renderTable(data) {
    const body = document.getElementById("league-body");
    const cMap = { 'wildcard': 'WC', 'freehit': 'FH', 'bboost': 'BB', '3xc': 'TC' };

    body.innerHTML = data.map((m, i) => `
        <tr style="${i < 3 ? 'background:rgba(0,255,135,0.04)' : ''}">
            <td style="text-align:center; font-weight:800; color:#6b7280;">${m.rank}</td>
            <td>
                <span class="m-name">${m.player_name}</span>
                <span class="t-name">${m.entry_name}</span>
            </td>
            <td style="font-weight:700;">${m.event_total}</td>
            <td style="font-weight:800; color:#37003c;">${m.total}</td>
            <td>
                ${m.chip ? `<span class="chip-badge chip-${m.chip}">${cMap[m.chip]}</span>` : ''}
                <span class="live-txt">©${m.capName}</span>
            </td>
            <td class="ovr-rank">#${m.ovr}</td>
        </tr>
    `).join('');
}

// Nav Logic (Kept the same)
const menuBtn = document.getElementById('menu-btn');
const closeBtn = document.getElementById('close-btn');
const drawer = document.getElementById('side-drawer');
const backdrop = document.getElementById('backdrop');
const toggle = () => { drawer.classList.toggle('open'); backdrop.classList.toggle('active'); };
[menuBtn, closeBtn, backdrop].forEach(el => el.addEventListener('click', toggle));

document.getElementById('refresh-btn').addEventListener('click', fetchProLeague);
document.addEventListener("DOMContentLoaded", fetchProLeague);
