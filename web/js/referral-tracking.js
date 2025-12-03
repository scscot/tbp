/**
 * Team Build Pro - Referral Tracking for CTA Buttons
 *
 * This script captures referral codes from URL parameters (?new= or ?ref=)
 * and dynamically updates Google Play Store links with the referrer parameter
 * for attribution tracking.
 *
 * Works across all pages: blog posts, company pages, etc.
 * Uses sessionStorage to persist referral data within the browser session.
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'tbp_referral';
  const TOKEN_KEY = 'tbp_referral_token';
  const TBP_FN_BASE = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net';

  /**
   * Validate referral code format
   */
  function isValidReferralCode(code) {
    return (
      code &&
      code.trim().length >= 3 &&
      code.length <= 50 &&
      !/[:/\\]/.test(code) &&
      !/^(file|C:)/.test(code)
    );
  }

  /**
   * Capture referral from URL parameters and store in sessionStorage
   */
  function captureReferral() {
    // Skip if running from file:// protocol
    if (window.location.protocol === 'file:') return;

    const urlParams = new URLSearchParams(window.location.search);
    const newCode = urlParams.get('new');
    const refCode = urlParams.get('ref');
    const targeting = urlParams.get('t') || '1';

    if (newCode || refCode) {
      const code = newCode || refCode;
      const type = newCode ? 'new' : 'partner';

      if (isValidReferralCode(code)) {
        const referralData = { code, type, targeting, capturedAt: Date.now() };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(referralData));
        console.log('[TBP Referral] Captured:', referralData);
      }
    }
  }

  /**
   * Get stored referral from sessionStorage
   */
  function getStoredReferral() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (err) {
      console.warn('[TBP Referral] Error reading storage:', err);
      return null;
    }
  }

  /**
   * Mint a referral token via Cloud Function
   */
  async function mintToken(referral) {
    try {
      const mintUrl = `${TBP_FN_BASE}/issueReferralV2`;
      const res = await fetch(mintUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorCode: referral.code,
          t: referral.targeting,
          source: 'cta_page'
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      return data.token || null;
    } catch (err) {
      console.warn('[TBP Referral] Token mint failed:', err);
      return null;
    }
  }

  /**
   * Update all Google Play links on the page with referrer parameter
   */
  async function updateGooglePlayLinks() {
    const referral = getStoredReferral();
    if (!referral) {
      console.log('[TBP Referral] No stored referral, links unchanged');
      return;
    }

    // Find all Google Play links
    const playLinks = document.querySelectorAll('a[href*="play.google.com"]');
    if (playLinks.length === 0) {
      console.log('[TBP Referral] No Google Play links found');
      return;
    }

    // Get token from storage or mint a new one
    let token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      console.log('[TBP Referral] Minting token for:', referral.code);
      token = await mintToken(referral);
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
        console.log('[TBP Referral] Token minted and cached');
      }
    }

    if (!token) {
      console.warn('[TBP Referral] No token available, links unchanged');
      return;
    }

    // Build referrer parameter payload
    const payload = `TBP_REF:${referral.code};TKN:${token};T:${referral.targeting};V:2`;
    const encodedPayload = encodeURIComponent(payload);

    // Update all Google Play links
    let updatedCount = 0;
    playLinks.forEach(link => {
      try {
        const url = new URL(link.href);
        if (!url.searchParams.has('referrer')) {
          url.searchParams.set('referrer', encodedPayload);
          link.href = url.toString();
          updatedCount++;
        }
      } catch (err) {
        console.warn('[TBP Referral] Error updating link:', err);
      }
    });

    console.log(`[TBP Referral] Updated ${updatedCount} Google Play links with referrer`);
  }

  /**
   * Initialize referral tracking
   */
  function init() {
    // Always capture referral from URL (in case user landed directly on this page)
    captureReferral();

    // Update Google Play links with referrer if we have a stored referral
    updateGooglePlayLinks();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
