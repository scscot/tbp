/**
 * Email Tracking Functions
 *
 * Provides real-time open and click tracking for SMTP-based email campaigns.
 * - trackEmailOpen: Returns 1x1 transparent GIF and logs opens to Firestore
 * - trackEmailClick: Logs clicks to Firestore and redirects to destination URL
 */

const { onRequest } = require("firebase-functions/v2/https");
const { db, FieldValue } = require('./shared/utilities');

// 1x1 transparent GIF (base64 decoded)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// =============================================================================
// OPEN TRACKING ENDPOINT
// =============================================================================

/**
 * Track email opens via invisible pixel
 *
 * URL: /trackEmailOpen?id={contactDocId}
 *
 * Updates Firestore with:
 * - openedAt: First open timestamp (only set once)
 * - openCount: Incremented on each open
 * - lastOpenedAt: Most recent open timestamp
 */
const trackEmailOpen = onRequest({
  region: "us-central1",
  memory: "128MiB",
  timeoutSeconds: 10,
  cors: true
}, async (req, res) => {
  const { id } = req.query;

  // Always return the pixel immediately (fire-and-forget Firestore update)
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  if (!id) {
    return res.send(TRANSPARENT_GIF);
  }

  try {
    const contactRef = db.collection('emailCampaigns').doc('master').collection('contacts').doc(id);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) {
      console.log(`📧 Open tracking: Contact ${id} not found`);
      return res.send(TRANSPARENT_GIF);
    }

    const data = contactDoc.data();
    const updateData = {
      openCount: FieldValue.increment(1),
      lastOpenedAt: FieldValue.serverTimestamp()
    };

    // Only set openedAt on first open
    if (!data.openedAt) {
      updateData.openedAt = FieldValue.serverTimestamp();
    }

    await contactRef.update(updateData);
    console.log(`📧 Open tracked for ${data.email} (id: ${id})`);

  } catch (error) {
    console.error(`❌ Open tracking error for ${id}: ${error.message}`);
  }

  return res.send(TRANSPARENT_GIF);
});

// =============================================================================
// CLICK TRACKING ENDPOINT
// =============================================================================

/**
 * Track email clicks and redirect to destination
 *
 * URL: /trackEmailClick?id={contactDocId}&url={encodedDestinationUrl}
 *
 * Checks both collections:
 * - emailCampaigns/master/contacts (main campaign)
 * - direct_sales_contacts (contacts campaign)
 *
 * Updates Firestore with:
 * - clickedAt: First click timestamp (only set once)
 * - clickCount: Incremented on each click
 * - lastClickedAt: Most recent click timestamp
 * - clickedUrls: Array of clicked destination URLs
 */
const trackEmailClick = onRequest({
  region: "us-central1",
  memory: "128MiB",
  timeoutSeconds: 10,
  cors: true
}, async (req, res) => {
  const { id, url } = req.query;

  if (!url) {
    return res.status(400).send('Missing destination URL');
  }

  const destinationUrl = decodeURIComponent(url);

  if (!id) {
    // No tracking ID, just redirect
    return res.redirect(302, destinationUrl);
  }

  try {
    // Try main campaign collection first
    let contactRef = db.collection('emailCampaigns').doc('master').collection('contacts').doc(id);
    let contactDoc = await contactRef.get();

    // If not found, try direct_sales_contacts collection
    if (!contactDoc.exists) {
      contactRef = db.collection('direct_sales_contacts').doc(id);
      contactDoc = await contactRef.get();
    }

    if (!contactDoc.exists) {
      console.log(`📧 Click tracking: Contact ${id} not found in any collection`);
      return res.redirect(302, destinationUrl);
    }

    const data = contactDoc.data();
    const updateData = {
      clickCount: FieldValue.increment(1),
      lastClickedAt: FieldValue.serverTimestamp(),
      clickedUrls: FieldValue.arrayUnion(destinationUrl)
    };

    // Only set clickedAt on first click
    if (!data.clickedAt) {
      updateData.clickedAt = FieldValue.serverTimestamp();
    }

    await contactRef.update(updateData);
    console.log(`📧 Click tracked for ${data.email} (id: ${id}) -> ${destinationUrl}`);

  } catch (error) {
    console.error(`❌ Click tracking error for ${id}: ${error.message}`);
  }

  return res.redirect(302, destinationUrl);
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  trackEmailOpen,
  trackEmailClick
};
