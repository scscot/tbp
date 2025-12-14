/**
 * Team Build Pro - Shared Header/Footer Components
 *
 * This file provides dynamically rendered header and footer components
 * with automatic locale detection and referral-aware logo links.
 *
 * Usage:
 * 1. Add <script src="/js/components.js"></script> to <head>
 * 2. Replace header HTML with: <div id="tbp-header"></div>
 * 3. Replace footer HTML with: <div id="tbp-footer"></div>
 */
(function() {
    'use strict';

    // =========================================================================
    // LOCALE DETECTION
    // =========================================================================
    const hostname = window.location.hostname;
    const locale = hostname.startsWith('es.') ? 'es' :
                   hostname.startsWith('pt.') ? 'pt' :
                   hostname.startsWith('de.') ? 'de' : 'en';

    // Domain mapping for language switcher
    const domains = {
        en: 'https://teambuildpro.com',
        es: 'https://es.teambuildpro.com',
        pt: 'https://pt.teambuildpro.com',
        de: 'https://de.teambuildpro.com'
    };

    // =========================================================================
    // TRANSLATIONS
    // =========================================================================
    const translations = {
        en: {
            pricing: 'Pricing',
            faq: 'FAQ',
            blog: 'Blog',
            books: 'Books',
            contact: 'Contact Us',
            recruitingGuides: 'Recruiting Guides',
            privacyPolicy: 'Privacy Policy',
            termsOfService: 'Terms of Service',
            copyright: 'Team Build Pro. All Rights Reserved.',
            langName: 'English',
            subtitle: 'AI Downline Builder'
        },
        es: {
            pricing: 'Precios',
            faq: 'Preguntas Frecuentes',
            blog: 'Blog',
            books: 'Libros',
            contact: 'Contacto',
            recruitingGuides: 'Guías de Reclutamiento',
            privacyPolicy: 'Política de Privacidad',
            termsOfService: 'Términos de Servicio',
            copyright: 'Team Build Pro. Todos los derechos reservados.',
            langName: 'Español',
            subtitle: 'Constructor de Redes con IA'
        },
        pt: {
            pricing: 'Preços',
            faq: 'Perguntas Frequentes',
            blog: 'Blog',
            books: 'Livros',
            contact: 'Contato',
            recruitingGuides: 'Guias de Recrutamento',
            privacyPolicy: 'Política de Privacidade',
            termsOfService: 'Termos de Serviço',
            copyright: 'Team Build Pro. Todos os direitos reservados.',
            langName: 'Português',
            subtitle: 'Construtor de Equipes com IA'
        },
        de: {
            pricing: 'Preise',
            faq: 'Häufige Fragen',
            blog: 'Blog',
            books: 'Bücher',
            contact: 'Kontakt',
            recruitingGuides: 'Recruiting-Leitfäden',
            privacyPolicy: 'Datenschutzrichtlinie',
            termsOfService: 'Nutzungsbedingungen',
            copyright: 'Team Build Pro. Alle Rechte vorbehalten.',
            langName: 'Deutsch',
            subtitle: 'KI-Downline-Builder'
        }
    };

    const t = translations[locale];

    // =========================================================================
    // REFERRAL CONTEXT
    // =========================================================================

    /**
     * Get referral information from URL or sessionStorage
     * Returns: { code: string, type: 'new'|'partner' } or null
     */
    function getReferralInfo() {
        const params = new URLSearchParams(window.location.search);
        const newCode = params.get('new');
        const refCode = params.get('ref');

        if (newCode) {
            return { code: newCode, type: 'new' };
        } else if (refCode) {
            return { code: refCode, type: 'partner' };
        }

        // Check sessionStorage for persisted referral
        try {
            const stored = sessionStorage.getItem('tbp_referral');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Only use if captured within last 24 hours
                if (parsed.capturedAt && (Date.now() - parsed.capturedAt) < 24 * 60 * 60 * 1000) {
                    return { code: parsed.code, type: parsed.type };
                }
            }
        } catch (e) {
            // Ignore storage errors
        }

        return null;
    }

    /**
     * Store referral info in sessionStorage for cross-page persistence
     */
    function storeReferralInfo(info) {
        if (!info) return;
        try {
            sessionStorage.setItem('tbp_referral', JSON.stringify({
                code: info.code,
                type: info.type,
                capturedAt: Date.now()
            }));
        } catch (e) {
            // Ignore storage errors
        }
    }

    /**
     * Determine the logo link based on referral context
     * - ?new=ABC → /prospects.html?new=ABC
     * - ?ref=ABC → /professionals.html?ref=ABC
     * - No referral → /
     */
    function getLogoLink() {
        const referral = getReferralInfo();
        if (referral) {
            if (referral.type === 'new') {
                return '/prospects.html?new=' + encodeURIComponent(referral.code);
            } else if (referral.type === 'partner') {
                return '/professionals.html?ref=' + encodeURIComponent(referral.code);
            }
        }
        return '/';
    }

    /**
     * Build language switcher link preserving query string
     * Note: Strips 'ref' and 'new' params to avoid triggering Universal Links
     * (referral context is already preserved in sessionStorage)
     */
    function buildLangLink(targetLocale) {
        const currentPath = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        // Remove referral params that trigger Universal Links
        params.delete('ref');
        params.delete('new');
        const cleanSearch = params.toString();
        return domains[targetLocale] + currentPath + (cleanSearch ? '?' + cleanSearch : '');
    }

    // =========================================================================
    // HEADER TEMPLATE
    // =========================================================================
    function renderHeader() {
        const logoLink = getLogoLink();
        const year = new Date().getFullYear();

        // Check which languages are available for this page
        const availableLangsAttr = document.documentElement.getAttribute('data-available-langs');
        const availableLangs = availableLangsAttr ? availableLangsAttr.split(',') : Object.keys(domains);

        // Build language switcher with proper active state (only show available languages)
        const langLinks = Object.keys(domains)
            .filter(lang => availableLangs.includes(lang))
            .map(lang => {
                if (lang === locale) {
                    return `<span class="lang-link active" lang="${lang}">${translations[lang].langName}</span>`;
                } else {
                    return `<a href="${buildLangLink(lang)}" hreflang="${lang}" lang="${lang}" class="lang-link">${translations[lang].langName}</a>`;
                }
            });
        const langSwitcher = langLinks.join('<span class="lang-separator">|</span>');

        return `
    <!-- Top Invite Bar (populated by JavaScript when referral exists) -->
    <div id="top-invite-bar" class="top-invite-bar"></div>

    <!-- Header -->
    <header class="header">
        <nav class="nav container">
            <a href="${logoLink}" class="logo" id="tbp-logo-link">
                <img src="/assets/icons/team-build-pro.png" alt="Team Build Pro" style="width: 32px; height: 32px; border-radius: 50%;">
                <span class="logo-text-group">
                    <span class="logo-title">Team Build Pro</span>
                    <span class="logo-subtitle">${t.subtitle}</span>
                </span>
            </a>
            <!-- Sandwich Menu Button -->
            <button id="menu-btn" class="menu-btn" aria-label="Open menu" aria-haspopup="true" aria-expanded="false">
                <span aria-hidden="true" style="font-size:2rem;color:#ffffff">☰</span>
            </button>
            <!-- Dropdown Menu -->
            <div id="mobile-menu" class="mobile-menu" role="menu">
                <a href="/faq.html" role="menuitem">${t.faq}</a>
                <a href="/#pricing" role="menuitem">${t.pricing}</a>
                <a href="/blog.html" role="menuitem">${t.blog}</a>
                <a href="/books.html" role="menuitem">${t.books}</a>
                <a href="/contact_us.html" role="menuitem">${t.contact}</a>
            </div>
        </nav>
        <!-- Language Switcher -->
        <div class="language-switcher header-language-switcher">
            ${langSwitcher}
        </div>
    </header>`;
    }

    // =========================================================================
    // FOOTER TEMPLATE
    // =========================================================================
    function renderFooter() {
        const year = new Date().getFullYear();

        return `
    <footer class="footer">
        <div class="container">
            <div class="footer-logo">
                <img src="/assets/icons/team-build-pro.png" alt="Team Build Pro" style="width: 32px; height: 32px; border-radius: 50%;">
                <span>Team Build Pro</span>
            </div>
            <div class="footer-links">
                <a href="/faq.html">${t.faq}</a>
                <a href="/#pricing">${t.pricing}</a>
                <a href="/books.html">${t.books}</a>
                <a href="/companies.html">${t.recruitingGuides}</a>
                <a href="/privacy_policy.html">${t.privacyPolicy}</a>
                <a href="/terms_of_service.html">${t.termsOfService}</a>
                <a href="/contact_us.html">${t.contact}</a>
            </div>
            <p>&copy; ${year} ${t.copyright}</p>
        </div>
    </footer>`;
    }

    // =========================================================================
    // VIDEO LIGHTBOX
    // =========================================================================
    function initVideoLightbox() {
        const lightbox = document.getElementById('video-lightbox');
        if (!lightbox) {
            console.log('Video lightbox: no lightbox element found');
            return;
        }

        const video = lightbox.querySelector('video');
        const closeBtn = lightbox.querySelector('.video-lightbox-close');
        const thumbnails = document.querySelectorAll('.video-thumbnail');
        const textLinks = document.querySelectorAll('.video-text-link');

        console.log('Video lightbox init:', {
            lightbox: !!lightbox,
            video: !!video,
            closeBtn: !!closeBtn,
            textLinks: textLinks.length
        });

        if (!video || !closeBtn) {
            console.log('Video lightbox: missing video or close button');
            return;
        }

        // Open lightbox on thumbnail click
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', function() {
                lightbox.classList.add('active');
                video.play().catch(() => {}); // Handle autoplay restrictions
            });
        });

        // Open lightbox on text link click
        textLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                lightbox.classList.add('active');
                video.play().catch(() => {}); // Handle autoplay restrictions
            });
        });

        // Close on X button
        closeBtn.addEventListener('click', function() {
            closeLightbox();
        });

        // Close on backdrop click
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                closeLightbox();
            }
        });

        function closeLightbox() {
            lightbox.classList.remove('active');
            video.pause();
            video.currentTime = 0;
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    function initComponents() {
        // Store referral info for cross-page persistence
        const referralInfo = getReferralInfo();
        if (referralInfo) {
            storeReferralInfo(referralInfo);
        }

        // Render header
        const headerPlaceholder = document.getElementById('tbp-header');
        if (headerPlaceholder) {
            headerPlaceholder.outerHTML = renderHeader();

            // Re-attach mobile menu toggle after render
            const menuBtn = document.getElementById('menu-btn');
            const mobileMenu = document.getElementById('mobile-menu');
            if (menuBtn && mobileMenu) {
                menuBtn.addEventListener('click', function() {
                    const isOpen = mobileMenu.classList.toggle('open');
                    menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                });

                // Close menu when clicking outside
                document.addEventListener('click', function(e) {
                    if (!menuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
                        mobileMenu.classList.remove('open');
                        menuBtn.setAttribute('aria-expanded', 'false');
                    }
                });
            }
        }

        // Render footer
        const footerPlaceholder = document.getElementById('tbp-footer');
        if (footerPlaceholder) {
            footerPlaceholder.outerHTML = renderFooter();
        }

        // Initialize video lightbox
        initVideoLightbox();
    }

    // ============================================================================
    // APP STORE LINK HANDLER
    // Handles App Store/Play Store clicks with Universal Link fallback for iOS
    // ============================================================================
    function openAppOrStore(platform) {
        const APP_STORE_URL = 'https://apps.apple.com/us/app/id6751211622';
        const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.scott.ultimatefix';

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (platform === 'android') {
            window.location.href = PLAY_STORE_URL;
            return;
        }

        if (platform === 'ios') {
            if (!isIOS) {
                window.location.href = APP_STORE_URL;
                return;
            }

            // On iOS - try Universal Link handoff via /claim.html
            // This preserves sponsor referral info through the app install flow
            const url = new URL(location.href);
            url.searchParams.delete('_ul');
            const params = url.search || '';
            const sep = params ? '&' : '?';

            // Use locale-appropriate domain for Universal Link
            const domain = window.location.hostname.includes('es.') ? 'https://es.teambuildpro.com' :
                          window.location.hostname.includes('pt.') ? 'https://pt.teambuildpro.com' :
                          window.location.hostname.includes('de.') ? 'https://de.teambuildpro.com' :
                          'https://teambuildpro.com';

            const UNIVERSAL_LINK = domain + '/claim.html' + params + sep + '_ul=1';
            window.location.href = UNIVERSAL_LINK;
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initComponents);
    } else {
        initComponents();
    }

    // Expose globally for onclick handlers and debugging
    window.openAppOrStore = openAppOrStore;
    window.TBPComponents = {
        locale: locale,
        getReferralInfo: getReferralInfo,
        getLogoLink: getLogoLink,
        openAppOrStore: openAppOrStore
    };
})();
