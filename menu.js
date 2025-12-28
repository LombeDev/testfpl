document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menu-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');
    
    // Touch variables for swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    const openDrawer = () => {
        drawer.classList.add('open');
        if (backdrop) {
            backdrop.style.display = 'block';
            // Small timeout to allow display:block to register before adding opacity
            setTimeout(() => backdrop.classList.add('active'), 10);
        }
        // Prevent background scrolling when menu is open
        document.body.style.overflow = 'hidden'; 
    };

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
        // Restore scrolling
        document.body.style.overflow = ''; 
    };

    // 1. Open Menu on Burger Icon Click
    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openDrawer();
        });
    }

    // 2. Close Menu on Backdrop Click (Tap Outside)
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            closeDrawer();
        });
    }

    // 3. Swipe to Close Logic (Mobile Gesture)
    drawer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    drawer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        // If swiped left more than 60 pixels, close the drawer
        if (touchStartX - touchEndX > 60) {
            closeDrawer();
        }
    }, { passive: true });

    // 4. Close Drawer when a link is clicked (Navigation)
    const drawerLinks = document.querySelectorAll('.drawer-links a');
    drawerLinks.forEach(link => {
        link.addEventListener('click', () => {
            closeDrawer();
        });
    });

    // 5. Global Escape Key listener for Desktop
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('open')) {
            closeDrawer();
        }
    });
});
