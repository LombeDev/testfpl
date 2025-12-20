// Drawer Selectors
const menuIcon = document.querySelector('.menu-icon');
const closeBtn = document.getElementById('close-btn');
const drawer = document.getElementById('side-drawer');
const backdrop = document.getElementById('backdrop');

// Drawer Functions
const toggleMenu = (isOpen) => {
    drawer.classList.toggle('open', isOpen);
    backdrop.classList.toggle('active', isOpen);
};

menuIcon.addEventListener('click', () => toggleMenu(true));
closeBtn.addEventListener('click', () => toggleMenu(false));
backdrop.addEventListener('click', () => toggleMenu(false));

// Form Logic
document.getElementById('change-id-btn').addEventListener('click', () => {
    const idVal = document.getElementById('fpl-id').value;
    if(idVal) {
        alert("Loading data for FPL ID: " + idVal);
    } else {
        alert("Please enter an ID first.");
    }
});
