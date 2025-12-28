/**
 * PreIntake.ai Intake Button
 *
 * Floating button that opens intake form in a modal overlay.
 *
 * Usage:
 * <script src="https://preintake.ai/intake-button.js" data-firm="YOUR_FIRM_ID"></script>
 * <script src="https://preintake.ai/intake-button.js" data-firm="YOUR_FIRM_ID" data-position="bottom-left"></script>
 *
 * Positions: bottom-right (default), bottom-left, bottom-center, top-right, top-left, top-center
 */
(function() {
    'use strict';

    // Get config from script tag
    const script = document.currentScript || document.querySelector('script[src*="intake-button.js"]');
    const firmId = script?.dataset?.firm;
    const position = script?.dataset?.position || 'bottom-right';

    if (!firmId) {
        console.error('PreIntake: Missing data-firm attribute');
        return;
    }

    // Validate position
    const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'bottom-center', 'top-center'];
    const buttonPosition = validPositions.includes(position) ? position : 'bottom-right';

    // URLs
    const CONFIG_URL = `https://us-west1-teambuilder-plus-fe74d.cloudfunctions.net/getWidgetConfig?firm=${firmId}`;
    const DEMO_URL = `https://us-west1-teambuilder-plus-fe74d.cloudfunctions.net/serveDemo?firm=${firmId}`;

    // State
    let config = null;

    /**
     * Initialize - fetch config and create button
     */
    async function init() {
        try {
            const response = await fetch(CONFIG_URL);
            if (response.ok) {
                config = await response.json();
            }
        } catch (e) {
            console.warn('PreIntake: Could not load config, using defaults');
        }

        // Default config
        if (!config) {
            config = {
                colors: { primary: '#0c1f3f', accent: '#c9a962' },
                firmName: 'Law Firm'
            };
        }

        createElements();
    }

    /**
     * Create button and modal elements
     */
    function createElements() {
        const primaryColor = config.colors?.primary || '#0c1f3f';
        const accentColor = config.colors?.accent || '#c9a962';

        // Create container
        const container = document.createElement('div');
        container.id = 'preintake-container';
        container.innerHTML = `
            <style>
                #preintake-container {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                /* Floating Button - Base */
                #preintake-button {
                    position: fixed;
                    z-index: 999998;
                    background: ${accentColor};
                    color: ${primaryColor};
                    border: none;
                    padding: 16px 28px;
                    border-radius: 50px;
                    font-size: 16px;
                    font-weight: 600;
                    font-family: inherit;
                    cursor: pointer;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.3s ease;
                }

                /* Position variants */
                #preintake-button.pos-bottom-right { bottom: 24px; right: 24px; }
                #preintake-button.pos-bottom-left { bottom: 24px; left: 24px; }
                #preintake-button.pos-bottom-center { bottom: 24px; left: 50%; transform: translateX(-50%); }
                #preintake-button.pos-top-right { top: 24px; right: 24px; }
                #preintake-button.pos-top-left { top: 24px; left: 24px; }
                #preintake-button.pos-top-center { top: 24px; left: 50%; transform: translateX(-50%); }

                #preintake-button:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                }

                #preintake-button.pos-top-right:hover,
                #preintake-button.pos-top-left:hover {
                    transform: translateY(3px);
                }

                #preintake-button.pos-bottom-center:hover {
                    transform: translateX(-50%) translateY(-3px);
                }

                #preintake-button.pos-top-center:hover {
                    transform: translateX(-50%) translateY(3px);
                }

                #preintake-button:active {
                    transform: translateY(-1px);
                }

                #preintake-button.pos-top-right:active,
                #preintake-button.pos-top-left:active {
                    transform: translateY(1px);
                }

                #preintake-button.pos-bottom-center:active {
                    transform: translateX(-50%) translateY(-1px);
                }

                #preintake-button.pos-top-center:active {
                    transform: translateX(-50%) translateY(1px);
                }

                #preintake-button svg {
                    width: 22px;
                    height: 22px;
                    flex-shrink: 0;
                }

                /* Hidden states - slide off in appropriate direction */
                #preintake-button.hidden.pos-bottom-right,
                #preintake-button.hidden.pos-bottom-left {
                    transform: translateY(100px);
                    opacity: 0;
                    pointer-events: none;
                }

                #preintake-button.hidden.pos-bottom-center {
                    transform: translateX(-50%) translateY(100px);
                    opacity: 0;
                    pointer-events: none;
                }

                #preintake-button.hidden.pos-top-right,
                #preintake-button.hidden.pos-top-left {
                    transform: translateY(-100px);
                    opacity: 0;
                    pointer-events: none;
                }

                #preintake-button.hidden.pos-top-center {
                    transform: translateX(-50%) translateY(-100px);
                    opacity: 0;
                    pointer-events: none;
                }

                /* Modal Overlay */
                #preintake-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 999999;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }

                #preintake-modal.open {
                    opacity: 1;
                    visibility: visible;
                }

                /* Modal Content */
                #preintake-modal-content {
                    width: 95%;
                    max-width: 480px;
                    height: 90vh;
                    max-height: 750px;
                    background: ${primaryColor};
                    border-radius: 20px;
                    overflow: hidden;
                    position: relative;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
                    transform: scale(0.9) translateY(20px);
                    transition: transform 0.3s ease;
                }

                #preintake-modal.open #preintake-modal-content {
                    transform: scale(1) translateY(0);
                }

                /* Close Button */
                #preintake-close {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    width: 36px;
                    height: 36px;
                    background: rgba(255, 255, 255, 0.15);
                    border: none;
                    border-radius: 50%;
                    color: white;
                    font-size: 24px;
                    line-height: 1;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    transition: background 0.2s ease;
                }

                #preintake-close:hover {
                    background: rgba(255, 255, 255, 0.25);
                }

                /* iframe */
                #preintake-iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }

                /* Mobile Styles */
                @media (max-width: 640px) {
                    #preintake-button {
                        padding: 14px 20px;
                        font-size: 14px;
                    }

                    #preintake-button.pos-bottom-right { bottom: 16px; right: 16px; }
                    #preintake-button.pos-bottom-left { bottom: 16px; left: 16px; }
                    #preintake-button.pos-bottom-center { bottom: 16px; }
                    #preintake-button.pos-top-right { top: 16px; right: 16px; }
                    #preintake-button.pos-top-left { top: 16px; left: 16px; }
                    #preintake-button.pos-top-center { top: 16px; }

                    #preintake-button span {
                        display: none;
                    }

                    #preintake-button svg {
                        width: 24px;
                        height: 24px;
                    }

                    #preintake-modal-content {
                        width: 100%;
                        height: 100%;
                        max-width: none;
                        max-height: none;
                        border-radius: 0;
                    }

                    #preintake-close {
                        top: 16px;
                        right: 16px;
                        width: 40px;
                        height: 40px;
                    }
                }

                /* Pulse animation for attention */
                @keyframes preintake-pulse {
                    0%, 100% { box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3); }
                    50% { box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 8px rgba(201, 169, 98, 0.2); }
                }

                #preintake-button.pulse {
                    animation: preintake-pulse 2s ease-in-out 3;
                }
            </style>

            <!-- Floating Button -->
            <button id="preintake-button" class="pulse pos-${buttonPosition}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>Free Case Evaluation</span>
            </button>

            <!-- Modal -->
            <div id="preintake-modal">
                <div id="preintake-modal-content">
                    <button id="preintake-close" aria-label="Close">×</button>
                    <iframe id="preintake-iframe" title="Case Evaluation Form"></iframe>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Attach event listeners
        attachEventListeners();
    }

    /**
     * Attach event listeners
     */
    function attachEventListeners() {
        const button = document.getElementById('preintake-button');
        const modal = document.getElementById('preintake-modal');
        const closeBtn = document.getElementById('preintake-close');
        const iframe = document.getElementById('preintake-iframe');

        // Open modal on button click
        button.addEventListener('click', () => {
            openModal();
        });

        // Close on X button
        closeBtn.addEventListener('click', () => {
            closeModal();
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('open')) {
                closeModal();
            }
        });

        // Load iframe src lazily (only when opened)
        function openModal() {
            if (!iframe.src || iframe.src === 'about:blank' || iframe.src === window.location.href) {
                iframe.src = DEMO_URL;
            }
            modal.classList.add('open');
            button.classList.add('hidden');
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            modal.classList.remove('open');
            button.classList.remove('hidden');
            document.body.style.overflow = '';
        }

        // Expose methods globally for programmatic control
        window.PreIntake = {
            open: openModal,
            close: closeModal
        };
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
