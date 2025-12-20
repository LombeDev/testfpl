const proxy = "https://corsproxy.io/?";
const LEAGUE_ID = "101712";

async function fetchProLeague() {
    const loader = document.getElementById("loading-overlay");
    loader.classList.remove("hidden");

    try {
        // 1. Get Static Data (Player Names)
        const staticRes = await fetch(proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"));
        const staticData = await staticRes.json();
        const playerNames = {};
        staticData.elements.forEach(p => playerNames[p.id] = p.web_name);
        
        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        // 2. Get League Standings
        const leagueRes = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/`));
        const leagueData = await leagueRes.json();
        const managers = leagueData.standings.results;

        // 3. Deep Fetch for each manager
        const detailedData = await Promise.all(managers.map(async (m) => {
            const historyRes = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/entry/${m.entry}/history/`));
            const history = await historyRes.json();
            
            const picksRes = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/entry/${m.entry}/event/${currentEvent}/picks/`));
            const picks = await picksRes.json();
            
            const currentGW = history.current[history.current.length - 1];
            const activeChip = history.chips.find(c => c.event === currentEvent);
            const captainObj = picks.picks.find(p => p.is_captain);

            return {
                ...m,
                overall: currentGW.overall_rank.toLocaleString(),
                val: (currentGW.value / 10).toFixed(1),
                chip: activeChip ? activeChip.name : null,
                captain: playerNames[captainObj.element]
            };
        }));

        renderTable(detailedData);
        loader.classList.add("hidden");
    } catch (err) {
        console.error("Pro Fetch Error", err);
        loader.classList.add("hidden");
    }
}

function renderTable(data) {
    const body = document.getElementById("league-body");
    const chipMeta = { 'wildcard': 'WC', 'freehit': 'FH', 'bboost': 'BB', '3xc': 'TC' };

    body.innerHTML = data.map((m, i) => `
        <tr style="${i === 0 ? 'background:rgba(0,255,135,0.05)' : ''}">
            <td><span class="rank-badge">${m.rank}</span></td>
            <td>
                <div class="manager-info">
                    <span class="m-name">${m.player_name}</span>
                    <span class="t-name">${m.entry_name}</span>
                </div>
            </td>
            <td class="gw-pts">${m.event_total}</td>
            <td class="tot-pts">${m.total}</td>
            <td>${m.chip ? `<span class="chip-badge chip-${m.chip}">${chipMeta[m.chip]}</span>` : '—'}</td>
            <td class="captain-cell"><i class="fa-solid fa-copyright" style="font-size:8px"></i> ${m.captain}</td>
            <td class="ovr-rank">#${m.overall}</td>
            <td><span class="val-tag">£${m.val}</span></td>
        </tr>
    `).join('');
}

document.getElementById("refresh-btn").addEventListener("click", fetchProLeague);
document.addEventListener("DOMContentLoaded", fetchProLeague);
