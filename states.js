document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('get-data-btn');
    const input = document.getElementById('fpl-id');
    const loginSection = document.getElementById('login-section');
    const dashboard = document.getElementById('dashboard');
    const resetBtn = document.getElementById('reset-id');

    // UI Logic for Switching Views
    btn.addEventListener('click', () => {
        const id = input.value.trim();
        if (id) {
            loginSection.classList.add('hidden');
            dashboard.classList.remove('hidden');
            fetchManagerData(id);
        } else {
            alert("Please enter a valid ID");
        }
    });

    resetBtn.addEventListener('click', () => {
        dashboard.classList.add('hidden');
        loginSection.classList.remove('hidden');
        input.value = '';
    });

    function fetchManagerData(id) {
        // Here you would normally use: 
        // fetch(`https://fantasy.premierleague.com/api/entry/${id}/live/`)
        
        // MOCK DATA BASED ON YOUR IMAGES
        document.getElementById('display-name').textContent = "Lombe Simakando";
        document.getElementById('safety-score').textContent = "71";
        document.getElementById('gw-points').textContent = "54";
        document.getElementById('total-points').textContent = "856";
        document.getElementById('live-rank').textContent = "6,099,660";
        document.getElementById('rank-change').innerHTML = `<span class="rank-down">▼ 2,734,082</span>`;
        
        renderBPS();
    }

    function renderBPS() {
        const container = document.getElementById('bps-list');
        // Mocking a live game: Man City vs West Ham (Capture2.PNG)
        const players = [
            { name: "Haaland", bps: 66, bonus: 3 },
            { name: "Matheus N.", bps: 34, bonus: 2 },
            { name: "Cherki", bps: 29, bonus: 1 }
        ];

        container.innerHTML = players.map(p => `
            <div class="bps-row">
                <span>${p.name}</span>
                <span>${p.bps}</span>
                <span class="rank-up">+${p.bonus}</span>
            </div>
        `).join('');
    }
});
