/**
 * PreIntake.ai - PostMessage Security Utilities
 * Shared origin validation for cross-frame communication
 */

(function(window) {
    'use strict';

    // Allowed origins for postMessage communication
    const ALLOWED_ORIGINS = [
        'https://preintake.ai',
        'https://us-west1-teambuilder-plus-fe74d.cloudfunctions.net'
    ];

    // For local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        ALLOWED_ORIGINS.push('http://localhost:5000');
        ALLOWED_ORIGINS.push('http://localhost:5001');
        ALLOWED_ORIGINS.push('http://127.0.0.1:5000');
        ALLOWED_ORIGINS.push('http://127.0.0.1:5001');
    }

    /**
     * Validate that a postMessage event comes from an allowed origin
     * @param {MessageEvent} event - The message event to validate
     * @returns {boolean} - True if origin is allowed, false otherwise
     */
    function isValidOrigin(event) {
        if (!event || !event.origin) {
            return false;
        }
        return ALLOWED_ORIGINS.includes(event.origin);
    }

    /**
     * Create a wrapped message handler that validates origin before processing
     * @param {Function} handler - The handler function to wrap
     * @returns {Function} - Wrapped handler that validates origin
     */
    function createSecureHandler(handler) {
        return function(event) {
            if (!isValidOrigin(event)) {
                console.warn('PostMessage rejected: invalid origin', event.origin);
                return;
            }
            handler(event);
        };
    }

    /**
     * Get the list of allowed origins (for reference)
     * @returns {string[]} - Array of allowed origin strings
     */
    function getAllowedOrigins() {
        return [...ALLOWED_ORIGINS];
    }

    // Export to window
    window.PreIntakePostMessage = {
        isValidOrigin: isValidOrigin,
        createSecureHandler: createSecureHandler,
        getAllowedOrigins: getAllowedOrigins,
        ALLOWED_ORIGINS: ALLOWED_ORIGINS
    };

})(window);
