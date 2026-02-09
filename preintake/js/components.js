/**
 * PreIntake.ai - Shared Header/Footer Components
 *
 * Usage:
 * 1. Add <script src="/js/components.js"></script> to <head>
 * 2. Add <div id="preintake-header"></div> where header should appear
 * 3. Add <div id="preintake-footer"></div> where footer should appear
 */
(function() {
    'use strict';

    // =========================================================================
    // HEADER COMPONENT
    // =========================================================================
    function renderHeader() {
        const container = document.getElementById('preintake-header');
        if (!container) return;

        container.innerHTML = `
            <header class="site-header">
                <div class="header-container">
                    <a href="/" class="logo">
                        <img src="/images/icon.svg" alt="PreIntake.ai" class="logo-icon">
                        <span class="logo-pre">Pre</span><span class="logo-intake">Intake</span><span class="logo-ai">.ai</span>
                    </a>
                    <button class="menu-toggle" aria-label="Toggle menu" aria-expanded="false">
                        <span class="hamburger"></span>
                    </button>
                    <nav class="nav-menu">
                        <a href="/">Home</a>
                        <a href="/#demo" id="nav-demo-link">Demo</a>
                        <a href="/#pricing">Pricing</a>
                        <a href="/about-us.html">About</a>
                        <a href="/faq.html">FAQs</a>
                        <a href="/contact-us.html">Contact</a>
                        <a href="/account.html" class="nav-account">My Account</a>
                    </nav>
                </div>
            </header>
        `;

        // Check if user has demo context (either viewed demo or navigated from demo page)
        // tbp_demo_viewed = set when user clicks "Start Demo" in iframe
        // tbp_demo_id = set when user navigates away from demo page (before or after starting)
        const headerTbpDemoViewed = sessionStorage.getItem('tbp_demo_viewed');
        const headerTbpDemoId = sessionStorage.getItem('tbp_demo_id');
        const demoViewedId = headerTbpDemoViewed || headerTbpDemoId;
        const accountBtn = container.querySelector('.nav-account');

        if (demoViewedId && accountBtn) {
            accountBtn.href = `https://preintake.ai/create-account.html?firm=${demoViewedId}`;
            accountBtn.textContent = 'Get Started →';
            accountBtn.classList.add('nav-get-started');

            // Also update the "Demo" link to go to their existing demo (not request a new one)
            const demoLink = container.querySelector('#nav-demo-link');
            if (demoLink) {
                demoLink.href = `/demo/?demo=${demoViewedId}`;
                demoLink.textContent = 'View Demo';
            }
        }

        // Add mobile menu toggle functionality
        const menuToggle = container.querySelector('.menu-toggle');
        const navMenu = container.querySelector('.nav-menu');

        if (menuToggle && navMenu) {
            menuToggle.addEventListener('click', () => {
                const isOpen = navMenu.classList.toggle('open');
                menuToggle.classList.toggle('open');
                menuToggle.setAttribute('aria-expanded', isOpen);
            });

            // Close menu when clicking a link
            navMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    navMenu.classList.remove('open');
                    menuToggle.classList.remove('open');
                    menuToggle.setAttribute('aria-expanded', 'false');
                });
            });
        }
    }

    // =========================================================================
    // HELPER: Check if on demo page
    // =========================================================================
    function isOnDemoPage() {
        const path = window.location.pathname;
        // Match /demo, /demo/, /demo/index.html, or any /demo/* path
        return path === '/demo' || path.startsWith('/demo/') || path.startsWith('/demo?');
    }

    // =========================================================================
    // WELCOME BANNER COMPONENT (shown for demo users on non-demo pages)
    // Uses same CSS classes as index.html's campaign-welcome banner
    // =========================================================================
    function renderWelcomeBanner() {
        // Don't render on the demo page itself (it has its own welcome display)
        if (isOnDemoPage()) return;

        // Don't render if already exists (index.html has its own)
        if (document.getElementById('campaign-welcome')) return;

        // Check if user has demo context
        const demoId = sessionStorage.getItem('tbp_demo_viewed') || sessionStorage.getItem('tbp_demo_id');
        const firmName = sessionStorage.getItem('tbp_demo_firm');

        if (!demoId) return;

        // Create banner element using same CSS classes as index.html
        const banner = document.createElement('div');
        banner.id = 'campaign-welcome';
        banner.className = 'campaign-welcome visible';
        banner.innerHTML = `
            <p class="campaign-welcome-text">Welcome, <strong>${firmName || 'Demo User'}</strong></p>
        `;

        // Insert after header
        const header = document.querySelector('.site-header');
        if (header && header.parentNode) {
            header.parentNode.insertBefore(banner, header.nextSibling);
        } else {
            document.body.insertBefore(banner, document.body.firstChild);
        }
    }

    // =========================================================================
    // FLOATING BUTTONS COMPONENT (shown after demo viewed, on non-demo pages)
    // =========================================================================
    function renderFloatingButtons() {
        // Don't render on the demo page itself (user is already viewing the demo)
        if (isOnDemoPage()) return;

        // Don't render if already exists (e.g., on index.html which has its own)
        if (document.getElementById('floating-demo-buttons')) return;

        // Check if user has demo context (either viewed demo or navigated from demo page)
        // tbp_demo_viewed = set when user clicks "Start Demo" in iframe
        // tbp_demo_id = set when user navigates away from demo page (before or after starting)
        const tbpDemoViewed = sessionStorage.getItem('tbp_demo_viewed');
        const tbpDemoId = sessionStorage.getItem('tbp_demo_id');
        const demoViewedId = tbpDemoViewed || tbpDemoId;
        if (!demoViewedId) return;

        // Create floating buttons container
        const container = document.createElement('div');
        container.className = 'floating-demo-buttons visible';
        container.id = 'floating-demo-buttons';
        container.innerHTML = `
            <a href="/create-account.html?firm=${demoViewedId}" class="get-started-btn" id="get-started-btn">
                Get Started
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            </a>
            <a href="/demo/?demo=${demoViewedId}" class="view-demo-btn" id="view-demo-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                View Demo
            </a>
        `;

        document.body.appendChild(container);
    }

    // =========================================================================
    // FOOTER COMPONENT
    // =========================================================================
    function renderFooter() {
        const container = document.getElementById('preintake-footer');
        if (!container) return;

        const year = new Date().getFullYear();

        container.innerHTML = `
            <footer class="site-footer">
                <div class="footer-container">
                    <div class="footer-copyright">
                        &copy; ${year} PreIntake.ai. All rights reserved.
                    </div>
                    <nav class="footer-links">
                        <a href="/privacy-policy.html">Privacy Policy</a>
                        <span class="divider">|</span>
                        <a href="/terms-of-service.html">Terms of Service</a>
                        <span class="divider">|</span>
                        <a href="/contact-us.html">Contact</a>
                    </nav>
                </div>
            </footer>
        `;
    }

    // =========================================================================
    // STYLES
    // =========================================================================
    function injectStyles() {
        if (document.getElementById('preintake-component-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'preintake-component-styles';
        styles.textContent = `
            /* Header Styles */
            .site-header {
                background: #0a1628;
                padding: 1rem 2rem;
                position: sticky;
                top: 0;
                z-index: 1000;
            }

            .header-container {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .logo {
                font-family: 'Playfair Display', serif;
                font-size: 1.75rem;
                font-weight: 700;
                text-decoration: none;
                display: flex;
                align-items: center;
                line-height: 1;
                transform: translateY(2px);
            }

            .logo-pre {
                color: #ffffff;
            }

            .logo-intake {
                color: #c9a962;
            }

            .logo-ai {
                color: #ffffff;
            }

            .logo-icon {
                height: 1.5rem;
                width: auto;
                margin-right: 0.5rem;
            }

            .nav-menu {
                display: flex;
                align-items: center;
                gap: 2rem;
            }

            .nav-menu a {
                color: #ffffff;
                text-decoration: none;
                font-size: 0.95rem;
                font-weight: 500;
                line-height: 1;
                transition: color 0.2s ease;
            }

            .nav-menu a:hover {
                color: #c9a962;
            }

            .nav-menu a.nav-account {
                background: rgba(201, 169, 98, 0.15);
                border: 1px solid rgba(201, 169, 98, 0.4);
                padding: 0.4rem 0.9rem;
                border-radius: 6px;
                color: #c9a962;
            }

            .nav-menu a.nav-account:hover {
                background: rgba(201, 169, 98, 0.25);
                border-color: #c9a962;
            }

            /* Get Started button (shown after demo viewed) */
            .nav-menu a.nav-get-started {
                background: linear-gradient(135deg, #c9a962 0%, #d4b978 100%);
                border: 1px solid #c9a962;
                color: #0a1628;
                font-weight: 600;
            }

            .nav-menu a.nav-get-started:hover {
                background: linear-gradient(135deg, #d4b978 0%, #e0c98a 100%);
                color: #0a1628;
            }

            /* Hamburger Menu */
            .menu-toggle {
                display: none;
                background: none;
                border: none;
                cursor: pointer;
                padding: 0.5rem;
                z-index: 1001;
            }

            .hamburger {
                display: block;
                width: 24px;
                height: 2px;
                background: #ffffff;
                position: relative;
                transition: background 0.2s ease;
            }

            .hamburger::before,
            .hamburger::after {
                content: '';
                position: absolute;
                width: 24px;
                height: 2px;
                background: #ffffff;
                left: 0;
                transition: transform 0.3s ease;
            }

            .hamburger::before {
                top: -7px;
            }

            .hamburger::after {
                top: 7px;
            }

            .menu-toggle.open .hamburger {
                background: transparent;
            }

            .menu-toggle.open .hamburger::before {
                transform: rotate(45deg) translate(5px, 5px);
            }

            .menu-toggle.open .hamburger::after {
                transform: rotate(-45deg) translate(5px, -5px);
            }

            /* Mobile Styles */
            @media (max-width: 768px) {
                .site-header {
                    padding: 1rem;
                }

                .menu-toggle {
                    display: block;
                }

                .nav-menu {
                    position: fixed;
                    top: 0;
                    right: -100%;
                    width: 280px;
                    height: 100vh;
                    background: linear-gradient(180deg, #0c1f3f 0%, #1a3a5c 100%);
                    flex-direction: column;
                    padding: 5rem 2rem 2rem;
                    gap: 1.5rem;
                    transition: right 0.3s ease;
                    box-shadow: -5px 0 20px rgba(0, 0, 0, 0.3);
                }

                .nav-menu.open {
                    right: 0;
                }

                .nav-menu a {
                    font-size: 1.1rem;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
            }

            /* Footer Styles */
            .site-footer {
                background: #0a1628;
                padding: 1.5rem 2rem;
                margin-top: auto;
            }

            .footer-container {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 1rem;
            }

            .footer-copyright {
                color: #a0aec0;
                font-size: 0.875rem;
            }

            .footer-links {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .footer-links a {
                color: #a0aec0;
                text-decoration: none;
                font-size: 0.875rem;
                transition: color 0.2s ease;
            }

            .footer-links a:hover {
                color: #c9a962;
            }

            .footer-links .divider {
                color: rgba(255, 255, 255, 0.2);
            }

            @media (max-width: 600px) {
                .footer-container {
                    flex-direction: column;
                    text-align: center;
                }

                .footer-links {
                    flex-wrap: wrap;
                    justify-content: center;
                }
            }

            /* Floating Buttons (shown after demo viewed) */
            .floating-demo-buttons {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                display: none;
                flex-direction: column;
                gap: 0.75rem;
                z-index: 9999;
            }

            .floating-demo-buttons.visible {
                display: flex;
            }

            .get-started-btn {
                padding: 1rem 1.5rem;
                background: linear-gradient(135deg, #c9a962 0%, #e5d4a1 50%, #c9a962 100%);
                color: #0c1f3f;
                border: none;
                border-radius: 50px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(201, 169, 98, 0.4);
                transition: all 0.3s ease;
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .get-started-btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 6px 25px rgba(201, 169, 98, 0.5);
            }

            .view-demo-btn {
                padding: 0.875rem 1.25rem;
                background: #0c1f3f;
                color: rgba(255, 255, 255, 0.9);
                border: 2px solid #1a3a5c;
                border-radius: 50px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                text-decoration: none;
            }

            .view-demo-btn:hover {
                background: #1a3a5c;
                border-color: #c9a962;
                transform: translateY(-2px);
            }

            @media (max-width: 768px) {
                .floating-demo-buttons {
                    bottom: 1rem;
                    right: 1rem;
                }

                .get-started-btn {
                    padding: 0.875rem 1.25rem;
                    font-size: 0.9rem;
                }

                .view-demo-btn {
                    padding: 0.75rem 1rem;
                    font-size: 0.85rem;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    function init() {
        injectStyles();
        renderHeader();
        renderWelcomeBanner();
        renderFooter();
        renderFloatingButtons();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
