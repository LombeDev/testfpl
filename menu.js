document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menu-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');
    
    let touchStartX = 0;
    let touchEndX = 0;

    const openDrawer = () => {
        drawer.classList.add('open');
        if (backdrop) {
            backdrop.style.display = 'block';
            setTimeout(() => backdrop.classList.add('active'), 10);
        }
        document.body.style.overflow = 'hidden'; 
    };

    const closeDrawer = () => {
        drawer.classList.remove('open');
        if (backdrop) {
            backdrop.classList.remove('active');
            setTimeout(() => {
                if (!drawer.classList.contains('open')) backdrop.style.display = 'none';
            }, 300);
        }
        document.body.style.overflow = ''; 
    };

    if (menuBtn) menuBtn.addEventListener('click', (e) => { e.stopPropagation(); openDrawer(); });
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Swipe Close
    drawer.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
    drawer.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 50) closeDrawer();
    }, {passive: true});

    document.querySelectorAll('.drawer-links a').forEach(link => {
        link.addEventListener('click', closeDrawer);
    });
});
