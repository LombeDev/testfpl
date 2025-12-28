/**
 * KOPALA FPL - Hamburger Menu & Sidebar Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');

    // Explicit Open Function
    const openDrawer = () => {
        drawer.classList.add('open');
        if (backdrop) {
            backdrop.style.display = 'block';
            // Small timeout to allow display:block to hit before adding opacity
            setTimeout(() => backdrop.classList.add('active'), 10);
        }
    };

    // Explicit Close Function
    const closeDrawer = () => {
        drawer.classList.remove('open');
        if (backdrop) {
            backdrop.classList.remove('active');
            // Wait for transition to finish before hiding display
            setTimeout(() => {
                if (!drawer.classList.contains('open')) {
                    backdrop.style.display = 'none';
                }
            }, 300);
        }
    };

    // Event Listeners
    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openDrawer();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDrawer();
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeDrawer);
    }

    // Close drawer when clicking a link
    const navLinks = document.querySelectorAll('.drawer-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', closeDrawer);
    });
});
