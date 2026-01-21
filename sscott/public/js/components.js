/**
 * Stephen Scott Website - Shared Header/Footer Components
 *
 * This file provides dynamically rendered header and footer components
 * for consistent navigation across all pages.
 *
 * Usage:
 * 1. Add <script src="/js/components.js"></script> before </body>
 * 2. Replace header HTML with: <div id="ss-header"></div>
 * 3. Replace footer HTML with: <div id="ss-footer"></div>
 */
(function() {
    'use strict';

    // =========================================================================
    // NAVIGATION ITEMS
    // =========================================================================
    const navItems = [
        { href: '/index.html', label: 'Home' },
        { href: '/about.html', label: 'About' },
        { href: '/books.html', label: 'Books' },
        { href: '/podcasts.html', label: 'Podcasts' },
        { href: '/blog.html', label: 'Blog' },
        { href: '/contact.html', label: 'Contact' }
    ];

    // =========================================================================
    // HEADER TEMPLATE
    // =========================================================================
    function renderHeader() {
        const currentPath = window.location.pathname;

        const navLinks = navItems.map(item => {
            // Check if this is the current page
            const isActive = currentPath === item.href ||
                           currentPath === item.href.replace('.html', '') ||
                           (item.href === '/index.html' && (currentPath === '/' || currentPath === ''));
            const activeStyle = isActive ? ' style="color: var(--accent-teal);"' : '';
            return `<li><a href="${item.href}"${activeStyle}>${item.label}</a></li>`;
        }).join('\n        ');

        return `
  <nav class="main-nav">
    <div class="nav-container">
      <a href="/" class="logo">Stephen Scott</a>
      <button class="mobile-menu-toggle" aria-label="Toggle menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <ul class="nav-links">
        ${navLinks}
      </ul>
    </div>
  </nav>`;
    }

    // =========================================================================
    // FOOTER TEMPLATE
    // =========================================================================
    function renderFooter() {
        const year = new Date().getFullYear();

        const footerLinks = navItems
            .filter(item => item.href !== '/index.html') // Exclude Home from footer
            .map(item => `<a href="${item.href}">${item.label}</a>`)
            .join(' &bull;\n      ');

        return `
  <footer class="main-footer">
    <p>&copy; ${year} Stephen Scott. All rights reserved.</p>
    <p>
      ${footerLinks}
    </p>
  </footer>`;
    }

    // =========================================================================
    // MOBILE MENU FUNCTIONALITY
    // =========================================================================
    function initMobileMenu() {
        const menuToggle = document.querySelector('.mobile-menu-toggle');
        const navLinks = document.querySelector('.nav-links');

        if (menuToggle && navLinks) {
            menuToggle.addEventListener('click', function() {
                navLinks.classList.toggle('active');
                menuToggle.classList.toggle('active');
            });

            // Close menu when clicking outside
            document.addEventListener('click', function(e) {
                if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
                    navLinks.classList.remove('active');
                    menuToggle.classList.remove('active');
                }
            });

            // Close menu when clicking a link
            navLinks.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', function() {
                    navLinks.classList.remove('active');
                    menuToggle.classList.remove('active');
                });
            });
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    function initComponents() {
        // Render header
        const headerPlaceholder = document.getElementById('ss-header');
        if (headerPlaceholder) {
            headerPlaceholder.outerHTML = renderHeader();
        }

        // Render footer
        const footerPlaceholder = document.getElementById('ss-footer');
        if (footerPlaceholder) {
            footerPlaceholder.outerHTML = renderFooter();
        }

        // Initialize mobile menu after rendering
        initMobileMenu();
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initComponents);
    } else {
        initComponents();
    }

    // Expose globally for debugging
    window.SSComponents = {
        renderHeader: renderHeader,
        renderFooter: renderFooter
    };
})();
