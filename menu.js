/**
 * KOPALA FPL - Hamburger Menu & Sidebar Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');

    const openDrawer = () => {
        drawer.classList.add('open');
        if (backdrop) {
            backdrop.style.display = 'block';
            // Delay class to trigger CSS transition
            setTimeout(() => backdrop.classList.add('active'), 10);
        }
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    };

    const closeDrawer = () => {
        drawer.classList.remove('open');
        if (backdrop) {
            backdrop.classList.remove('active');
            setTimeout(() => {
                if (!drawer.classList.contains('open')) {
                    backdrop.style.display = 'none';
                }
            }, 300);
        }
        document.body.style.overflow = ''; // Re-enable scroll
    };

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

    // Auto-close on link click
    const navLinks = document.querySelectorAll('.drawer-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', closeDrawer);
    });
});
