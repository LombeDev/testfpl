document.getElementById('change-id-btn').addEventListener('click', function() {
    const fplId = document.getElementById('fpl-id').value;

    if (fplId.trim() === "") {
        alert("Please enter a valid FPL ID");
    } else {
        console.log("Fetching data for ID:", fplId);
        // Here you would typically redirect or call an FPL API
        alert("ID Submitted: " + fplId);
    }
});
async function updateRank() {
    // This typically requires fetching the 'entry' endpoint
    // and comparing live points against the 'league' standings
    // For this example, we'll simulate the update
    document.getElementById('rank-value').innerText = "124,502";
    document.getElementById('mini-league-pos').innerText = "League Pos: 2nd";
}

// Update every 60 seconds
setInterval(updateLiveStats, 60000);
updateLiveStats();
