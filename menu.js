/**
 * KOPALA FPL - Navigation & Sidebar Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');

    // Function to open/close navigation
    const toggleNavigation = () => {
        const isOpen = drawer.classList.toggle('open');
        
        // Handle backdrop visibility and animation
        if (backdrop) {
            backdrop.classList.toggle('active');
            backdrop.style.display = isOpen ? 'block' : 'none';
        }
    };

    // Attach listeners to Menu icon, Close 'X', and the dark Backdrop
    [menuBtn, closeBtn, backdrop].forEach(element => {
        if (element) {
            element.addEventListener('click', toggleNavigation);
        }
    });
});
