/**
 * KOPALA FPL - Hamburger Menu & Sidebar Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');

    // Function to toggle the drawer
    const toggleDrawer = () => {
        // Toggle the 'open' class on the drawer
        drawer.classList.toggle('open');
        
        // Toggle the 'active' class on the backdrop
        if (backdrop) {
            backdrop.classList.toggle('active');
            
            // Explicitly handle display for safety
            if (drawer.classList.contains('open')) {
                backdrop.style.display = 'block';
            } else {
                backdrop.style.display = 'none';
            }
        }
    };

    // Close drawer when clicking a link (optional but recommended for UX)
    const navLinks = document.querySelectorAll('.drawer-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            drawer.classList.remove('open');
            backdrop.classList.remove('active');
            backdrop.style.display = 'none';
        });
    });

    // Event Listeners
    if (menuBtn) menuBtn.addEventListener('click', toggleDrawer);
    if (closeBtn) closeBtn.addEventListener('click', toggleDrawer);
    if (backdrop) backdrop.addEventListener('click', toggleDrawer);
});
