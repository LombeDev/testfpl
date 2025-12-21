const LEAGUE_ID = "101712";
const PROXIES = [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?",
    "https://thingproxy.freeboard.io/fetch/"
];

async function smartFetch(url) {
    for (let proxy of PROXIES) {
        try {
            const res = await fetch(proxy + encodeURIComponent(url));
            if (res.ok) return await res.json();
        } catch (e) { continue; }
    }
    throw new Error("API Connection Failed");
}

async function initDashboard() {
    const body = document.getElementById("league-body");
    const loader = document.getElementById("loading-overlay");
    const errorBanner = document.getElementById("error-banner");

    loader.classList.remove("hidden");
    errorBanner.classList.add("hidden");

    try {
        // 1. Fetch Basic Data
        const staticData = await smartFetch("https://fantasy.premierleague.com/api/bootstrap-static/");
        const playerNames = {};
        staticData.elements.forEach(p => playerNames[p.id] = p.web_name);
        const curGW = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${curGW}`;

        // 2. Fetch League Standings
        const leagueData = await smartFetch(`https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/`);
        const managers = leagueData.standings.results;

        // 3. Parallel Deep Fetch (Limited to top 50 for speed)
        const detailed = await Promise.all(managers.slice(0, 50).map(async (m) => {
            try {
                const [h, p] = await Promise.all([
                    smartFetch(`https://fantasy.premierleague.com/api/entry/${m.entry}/history/`),
                    smartFetch(`https://fantasy.premierleague.com/api/entry/${m.entry}/event/${curGW}/picks/`)
                ]);
                const lastH = h.current[h.current.length - 1];
                const chip = h.chips.find(c => c.event === curGW);
                const cap = p.picks.find(pk => pk.is_captain);
                return { 
                    ...m, 
                    ovr: lastH.overall_rank.toLocaleString(), 
                    chip: chip ? chip.name : null, 
                    cap: playerNames[cap.element] 
                };
            } catch { 
                return { ...m, ovr: "---", chip: null, cap: "---" }; 
            }
        }));

        renderTable(detailed);
        loader.classList.add("hidden");
    } catch (err) {
        errorBanner.classList.remove("hidden");
        loader.classList.add("hidden");
    }
}

function renderTable(data) {
    const body = document.getElementById("league-body");
    const chips = { 'wildcard': 'WC', 'freehit': 'FH', 'bboost': 'BB', '3xc': 'TC' };

    body.innerHTML = data.map((m, i) => `
        <tr style="${i < 3 ? 'background:rgba(0,255,135,0.03)' : ''}">
            <td style="text-align:center; font-weight:800; color:#94a3b8;">${m.rank}</td>
            <td>
                <span class="m-name">${m.player_name}</span>
                <span class="t-name">${m.entry_name}</span>
            </td>
            <td class="pts-gw">${m.event_total}</td>
            <td class="pts-tot">${m.total}</td>
            <td class="live-cell">
                ${m.chip ? `<span class="chip-badge chip-${m.chip}">${chips[m.chip]}</span>` : ''}
                <span class="cap-name">©${m.cap}</span>
            </td>
            <td class="ovr-rank">#${m.ovr}</td>
        </tr>
    `).join('');
}

// Side Drawer Logic
const menuBtn = document.getElementById('menu-btn');
const closeBtn = document.getElementById('close-btn');
const drawer = document.getElementById('side-drawer');
const backdrop = document.getElementById('backdrop');

const toggle = () => { drawer.classList.toggle('open'); backdrop.classList.toggle('active'); };
[menuBtn, closeBtn, backdrop].forEach(el => el.addEventListener('click', toggle));

document.getElementById('refresh-btn').addEventListener('click', initDashboard);
document.addEventListener("DOMContentLoaded", initDashboard);
