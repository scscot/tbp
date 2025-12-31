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
                        <a href="/#demo">Demo</a>
                        <a href="/#pricing">Pricing</a>
                        <a href="/about-us.html">About</a>
                        <a href="/faq.html">FAQs</a>
                        <a href="/contact-us.html">Contact</a>
                    </nav>
                </div>
            </header>
        `;

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
                height: 1.75rem;
                width: auto;
                margin-right: 0.5rem;
                vertical-align: middle;
            }

            .nav-menu {
                display: flex;
                gap: 2rem;
            }

            .nav-menu a {
                color: #ffffff;
                text-decoration: none;
                font-size: 0.95rem;
                font-weight: 500;
                transition: color 0.2s ease;
            }

            .nav-menu a:hover {
                color: #c9a962;
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
        `;

        document.head.appendChild(styles);
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    function init() {
        injectStyles();
        renderHeader();
        renderFooter();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
