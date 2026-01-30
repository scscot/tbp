/**
 * Team Build Pro - Referral Tracking for CTA Buttons
 *
 * This script captures referral codes from URL parameters (?new= or ?ref=)
 * and dynamically updates Google Play Store links with the referrer parameter
 * for attribution tracking.
 *
 * Also displays the Top Invite Bar showing sponsor name and avatar across all pages.
 *
 * Works across all pages: blog posts, company pages, etc.
 * Uses sessionStorage to persist referral data within the browser session.
 */
(function() {
  'use strict';

  // Localized labels (EN version)
  const LABELS = {
    invited: 'Invited by',
    recommended: 'Recommended by',
    welcome: 'Welcome'
  };

  // Storage key for email campaign welcome data
  const WELCOME_KEY = 'tbp_welcome_data';

  const STORAGE_KEY = 'tbp_referral';
  const TOKEN_KEY = 'tbp_referral_token';
  const SPONSOR_KEY = 'tbp_sponsor_data';
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
   * Capture welcome data from email campaign URL parameters (fn, ln)
   * Returns true if welcome data was captured
   */
  function captureWelcomeData() {
    // Skip if running from file:// protocol
    if (window.location.protocol === 'file:') return false;

    const urlParams = new URLSearchParams(window.location.search);
    const firstName = urlParams.get('fn');
    const lastName = urlParams.get('ln');

    if (firstName) {
      const welcomeData = {
        firstName: firstName,
        lastName: lastName || '',
        capturedAt: Date.now()
      };
      sessionStorage.setItem(WELCOME_KEY, JSON.stringify(welcomeData));
      console.log('[TBP Referral] Welcome data captured:', welcomeData);
      return true;
    }
    return false;
  }

  /**
   * Get stored welcome data from sessionStorage
   */
  function getStoredWelcomeData() {
    try {
      const stored = sessionStorage.getItem(WELCOME_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (err) {
      console.warn('[TBP Referral] Error reading welcome storage:', err);
      return null;
    }
  }

  /**
   * Capture referral from URL parameters and store in sessionStorage
   * Returns true if referral was captured (used to determine priority)
   */
  function captureReferral() {
    // Skip if running from file:// protocol
    if (window.location.protocol === 'file:') return false;

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
        // Clear any welcome data - referral takes priority
        sessionStorage.removeItem(WELCOME_KEY);
        console.log('[TBP Referral] Captured:', referralData);
        return true;
      }
    }
    return false;
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
   * Get or create the Top Invite Bar HTML element
   */
  function getOrCreateInviteBarElement() {
    // Check if element already exists (created by components.js or in HTML)
    const existing = document.getElementById('top-invite-bar');
    if (existing) return existing;

    // Create if doesn't exist
    const bar = document.createElement('div');
    bar.id = 'top-invite-bar';
    bar.className = 'top-invite-bar';
    document.body.insertBefore(bar, document.body.firstChild);
    return bar;
  }

  /**
   * Fetch sponsor data from Cloud Function
   */
  async function fetchSponsorData(referralCode) {
    try {
      const url = `${TBP_FN_BASE}/getUserByReferralCode?code=${referralCode}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.warn('[TBP Referral] Sponsor fetch failed:', err);
      return null;
    }
  }

  /**
   * Get cached sponsor data or fetch from API
   */
  async function getSponsorData(referralCode) {
    // Check cache first
    try {
      const cached = sessionStorage.getItem(SPONSOR_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.code === referralCode) {
          console.log('[TBP Referral] Using cached sponsor data');
          return data;
        }
      }
    } catch (err) {
      console.warn('[TBP Referral] Error reading sponsor cache:', err);
    }

    // Fetch from API
    const userData = await fetchSponsorData(referralCode);
    if (userData && userData.firstName) {
      const sponsorData = {
        code: referralCode,
        firstName: userData.firstName,
        lastName: userData.lastName,
        photoUrl: userData.photoUrl || userData.photoURL || userData.profilePhotoUrl || null,
        bizOppName: userData.bizOppName || null
      };
      try {
        sessionStorage.setItem(SPONSOR_KEY, JSON.stringify(sponsorData));
      } catch (err) {
        console.warn('[TBP Referral] Error caching sponsor data:', err);
      }
      return sponsorData;
    }
    return null;
  }

  /**
   * Show the Top Invite Bar with welcome message (for email campaign visitors)
   * Returns true if welcome bar was shown
   */
  function showWelcomeBar() {
    const welcomeData = getStoredWelcomeData();
    if (!welcomeData) {
      return false;
    }

    const bar = getOrCreateInviteBarElement();
    if (!bar) {
      console.log('[TBP Referral] Could not get or create invite bar element');
      return false;
    }

    const fullName = welcomeData.lastName
      ? `${welcomeData.firstName} ${welcomeData.lastName}`
      : welcomeData.firstName;

    bar.innerHTML = `
      <span class="top-invite-text">${LABELS.welcome} ${fullName}</span>
    `;

    // Trigger animation
    requestAnimationFrame(() => {
      bar.classList.add('visible');
      bar.style.top = '0';
    });

    console.log('[TBP Referral] Welcome bar shown for:', fullName);
    return true;
  }

  /**
   * Show the Top Invite Bar with sponsor info
   * Priority: Referral (?ref=/?new=) > Welcome (?fn=)
   */
  async function showInviteBar() {
    // PRIORITY 1: Check for referral data (from ?ref= or ?new= params)
    // Referral ALWAYS takes priority over welcome message
    const referral = getStoredReferral();
    if (referral) {
      const sponsor = await getSponsorData(referral.code);
      if (sponsor) {
        const bar = getOrCreateInviteBarElement();
        if (bar) {
          const label = (referral.type === 'partner') ? LABELS.recommended : LABELS.invited;
          const fullName = `${sponsor.firstName} ${sponsor.lastName}`;
          const avatarUrl = sponsor.photoUrl || '/assets/images/default_avatar.png';

          bar.innerHTML = `
            <img src="${avatarUrl}" alt="${fullName}" class="top-invite-avatar"
                 onerror="this.src='/assets/images/default_avatar.png';">
            <span class="top-invite-text">${label} ${fullName}</span>
          `;

          // Trigger animation
          requestAnimationFrame(() => {
            bar.classList.add('visible');
            bar.style.top = '0';
          });

          console.log('[TBP Referral] Invite bar shown for:', fullName);
          return; // Done - referral bar shown
        }
      } else {
        console.log('[TBP Referral] Could not fetch sponsor data');
      }
    }

    // PRIORITY 2: Fall back to welcome message (from email campaign ?fn= params)
    // Only shown if NO referral data exists
    if (showWelcomeBar()) {
      return;
    }

    console.log('[TBP Referral] No referral or welcome data, bar not shown');
  }

  /**
   * Initialize referral tracking
   * Priority: Referral (?ref=/?new=) > Welcome (?fn=)
   */
  function init() {
    // FIRST: Capture referral from URL - this takes priority
    // If referral is captured, it clears any existing welcome data
    const hasReferral = captureReferral();

    // SECOND: Only capture welcome data if no referral params in URL
    // This ensures referral always wins when both could be present
    if (!hasReferral) {
      captureWelcomeData();
    }

    // Update Google Play links with referrer if we have a stored referral
    updateGooglePlayLinks();

    // Show the Top Invite Bar (referral takes priority over welcome)
    showInviteBar();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
