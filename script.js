document.addEventListener('DOMContentLoaded', () => {
    // 1. Get all content sections and navigation items
    const sections = document.querySelectorAll('.content-section');
    const navItems = document.querySelectorAll('.nav-item');

    // 2. Options for the Intersection Observer
    const observerOptions = {
        // Root is the viewport (default)
        root: null, 
        // Margin around the viewport. A negative top margin helps trigger the
        // change slightly before the section fully leaves the screen top.
        // A negative bottom margin ensures the item is mostly visible before
        // it becomes 'active'.
        rootMargin: '-50% 0px -50% 0px', 
        // 0 means fire when 0% of the target is visible (we rely on rootMargin)
        threshold: 0
    };

    /**
     * Updates the bottom navigation bar based on the intersecting section.
     * @param {string} activeId The ID of the section currently in view.
     */
    function updateNavBar(activeId) {
        navItems.forEach(item => {
            // Remove 'active' class from all items
            item.classList.remove('active'); 
            
            // Add 'active' class to the matching item
            if (item.getAttribute('data-id') === activeId) {
                item.classList.add('active');
            }
        });
    }

    // 3. Create the Intersection Observer
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            // Check if the section is currently intersecting (i.e., visible)
            if (entry.isIntersecting) {
                // Get the ID of the visible section (e.g., 'home', 'stats')
                const sectionId = entry.target.id;
                
                // Update the navigation bar
                updateNavBar(sectionId);
            }
        });
    }, observerOptions);

    // 4. Start observing each content section
    sections.forEach(section => {
        observer.observe(section);
    });
    
    // 5. Add click listener for smooth scrolling on nav links
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault(); // Stop default jump
            const targetId = this.getAttribute('data-id');
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start' // Scroll to the top of the element
                });
            }
        });
    });
});