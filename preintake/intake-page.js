/**
 * PreIntake.ai Full Page Embed
 *
 * Embeds the intake form directly on a page (no button, no modal).
 *
 * Usage:
 * <div id="preintake-form" style="width: 100%; min-height: 700px;"></div>
 * <script src="https://preintake.ai/intake-page.js" data-firm="YOUR_FIRM_ID"></script>
 *
 * The iframe will fill the container. Style the container to control dimensions.
 */
(function() {
    'use strict';

    // Get config from script tag
    const script = document.currentScript || document.querySelector('script[src*="intake-page.js"]');
    const firmId = script?.dataset?.firm;

    if (!firmId) {
        console.error('PreIntake: Missing data-firm attribute');
        return;
    }

    // Demo URL
    const DEMO_URL = `https://us-west1-teambuilder-plus-fe74d.cloudfunctions.net/serveDemo?firm=${firmId}`;

    /**
     * Initialize - create iframe in container
     */
    function init() {
        // Find existing container or create one
        let container = document.getElementById('preintake-form');

        if (!container) {
            // Create container after script if none exists
            container = document.createElement('div');
            container.id = 'preintake-form';
            container.style.cssText = 'width: 100%; min-height: 700px;';
            script.parentNode.insertBefore(container, script.nextSibling);
        }

        // Create and append iframe
        const iframe = document.createElement('iframe');
        iframe.src = DEMO_URL;
        iframe.title = 'Free Case Evaluation';
        iframe.loading = 'eager';
        iframe.style.cssText = 'width: 100%; height: 100%; min-height: 700px; border: none; border-radius: 12px; display: block;';

        // Clear container and add iframe
        container.innerHTML = '';
        container.appendChild(iframe);

        // Optional: Listen for height updates from iframe for dynamic sizing
        window.addEventListener('message', (event) => {
            if (event.data?.type === 'preintake-resize' && event.data?.height) {
                iframe.style.height = event.data.height + 'px';
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
