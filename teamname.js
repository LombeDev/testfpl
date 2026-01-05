const fplDatabase = {
    // PLAYER SPECIFIC
    "salah": ["Que Salah Salah", "Chicken Tikka Mo Salah", "Salah-vating Victory", "When Harry Met Salah"],
    "haaland": ["Haaland Globetrotters", "Haalandaise Sauce", "The Erling Force", "Ha Ha Haaland"],
    "palmer": ["Ice Cold Palmer", "Palmer Violets", "Palmer Chameleon", "Keep Cold"],
    "rice": ["Rice Rice Baby", "Basmati Rice", "GTA: Rice City", "The Rice is Right"],
    "saka": ["Major League Saka", "BooyaSaka", "Saka Potatoes", "Starboy"],
    "havertz": ["Cobra Kai Havertz", "Old Havertz Kai Hard", "Don't Kai For Me"],
    "slot": ["Drop It Like It's Slot", "The Slot Thickens", "Slot Machine", "One Man Arne"],
    "eze": ["Eze Come Eze Go", "Go Eze on Mee", "Eze Lover"],
    "son": ["Ain't No Sonshine", "Empire of the Son", "Sonsational FC"],
    "foden": ["El Wey Foden", "Foden Focus", "Star Wars: The Foden Menace"],
    "gordon": ["Gordons of the Galaxy", "Flash Gordon", "Gordon and Dusted"],
    "onana": ["Onana, What's My Name?", "Onana Wirtz My Name", "Onana Split"],
    "saliba": ["Livin' Saliba Loca", "Saliba Shield"],
    "vandyke": ["Van Dijk's Vandals", "Big Dijk Energy"],
    "zirkzee": ["Zirkzee Zodiacs", "Bringing Zirkzee Back"],
    "de ligt": ["Afternoon De Ligt", "Ctrl Alt De Ligt"],
    
    // CLUB SPECIFIC
    "arsenal": ["Zubi-dubi-doo", "Machine Gun Skelly", "I'm Yelling Timber", "Øde Toilette"],
    "chelsea": ["Sorry Nic Jackson", "Under My Cucurella", "Reece's Set Pieces", "Stuck in the Mudryk"],
    "liverpool": ["Alisson Wonderland", "The 40 Year Old Virgil", "Pain in Diaz", "Mac Allister Move"],
    "man utd": ["Ratcliffehanger", "Mainoo Magic", "Shaw and Order", "Bruno Dos Tres"],
    "spurs": ["Thomas The Frank Engine", "Van de Ven Diagram", "Los Porro Hermanos"],

    // GENERAL POOL
    "general": [
        "Inter Yanan", "Tea & Busquets", "Blink-1 Eto'o", "Netflix and Chilwell",
        "Hakuna Mateta", "Botman Begins", "Clyne of Duty", "Lord of the Ings",
        "Gvardiols of the Galaxy", "Iwobi-Wan Kenobi", "Bayer Neverlusen", 
        "Grosstitutes", "Target Practice", "Expected Toulouse", "Sarri Not Sarri",
        "Kloppenheimer", "Ange Management", "Gangsta's Allardyce", "360 No Pope",
        "Bowen Arrow", "Neville Wears Prada", "Cesc and the City", "Petr Cech Yourself",
        "Lallana Del Rey", "Snoop Udogie Dogg", "Abra Dubravka", "The Burn Identity"
    ]
};

const display = document.getElementById('name-display');
const btn = document.getElementById('generate-btn');
const input = document.getElementById('player-input');
const historyList = document.getElementById('history-list');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');

btn.addEventListener('click', () => {
    const userInput = input.value.toLowerCase().trim();
    let pool = fplDatabase["general"];

    // Check for specific matches
    for (let key in fplDatabase) {
        if (key !== "general" && userInput.includes(key)) {
            pool = fplDatabase[key];
            break;
        }
    }

    // Animation Effect
    let iterations = 0;
    btn.disabled = true;
    
    const interval = setInterval(() => {
        const randomTemp = fplDatabase.general[Math.floor(Math.random() * fplDatabase.general.length)];
        display.innerText = randomTemp;
        display.classList.remove('pop');
        
        iterations++;
        if (iterations > 12) {
            clearInterval(interval);
            const finalName = pool[Math.floor(Math.random() * pool.length)];
            display.innerText = finalName;
            display.classList.add('pop');
            btn.disabled = false;
            addToHistory(finalName);
        }
    }, 60);
});

function addToHistory(name) {
    const li = document.createElement('li');
    li.innerText = name;
    historyList.prepend(li);
    if (historyList.children.length > 5) historyList.removeChild(historyList.lastChild);
}

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(display.innerText);
    copyBtn.innerText = "COPIED!";
    setTimeout(() => copyBtn.innerText = "COPY", 1000);
});

clearBtn.addEventListener('click', () => {
    input.value = "";
    display.innerText = "READY?";
});
