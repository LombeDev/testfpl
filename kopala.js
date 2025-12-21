const proxy = "https://corsproxy.io/?";
const LEAGUE_ID = "101712";

async function fetchProLeague() {
    const loader = document.getElementById("loading-overlay");
    loader.classList.remove("hidden");

    try {
        // 1. Get Game Config & Player Names
        const staticRes = await fetch(proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"));
        const staticData = await staticRes.json();
        const players = {};
        staticData.elements.forEach(p => players[p.id] = p.web_name);
        const curGW = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${curGW}`;

        // 2. Get Standings
        const leagueRes = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/`));
        const leagueData = await leagueRes.json();
        const managers = leagueData.standings.results;

        // 3. Batch Fetch Deep Data (History + Picks)
        const detailed = await Promise.all(managers.map(async (m) => {
            try {
                const [hRes, pRes] = await Promise.all([
                    fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/entry/${m.entry}/history/`)),
                    fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/entry/${m.entry}/event/${curGW}/picks/`))
                ]);
                const h = await hRes.json();
                const p = await pRes.json();
                
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
                return { ...m, ovr: "N/A", chip: null, capName: "N/A" };
            }
        }));

        renderTable(detailed);
        loader.classList.add("hidden");
    } catch (err) {
        console.error("Fetch Error");
        loader.classList.add("hidden");
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
            <td style="font-weight:800; color:var(--fpl-purple);">${m.total}</td>
            <td>
                ${m.chip ? `<span class="chip-badge chip-${m.chip}">${cMap[m.chip]}</span>` : ''}
                <span class="live-txt">©${m.capName}</span>
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

document.getElementById('refresh-btn').addEventListener('click', fetchProLeague);
document.addEventListener("DOMContentLoaded", fetchProLeague);
