// functions/analytics-events.js
// Lightweight analytics for TBP token handoff system
// Tracks organic vs referral CTA clicks and attribution events

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');

const corsHandler = require('./shared/utilities').corsHandler;

// Initialize Firestore
const db = getFirestore();

// Event logger for web analytics
const tbpEventLog = onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Parse request body
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (!body || !body.e) {
        return res.status(400).json({ error: 'Event name required' });
      }

      // Hash IP for privacy
      const ip = req.headers['x-forwarded-for'] || req.ip || '';
      const ipHash = crypto.createHash('sha256').update(ip.toString()).digest('base64url').substring(0, 16);

      // Prepare event document
      const eventDoc = {
        event: body.e,
        timestamp: new Date(),
        serverTs: Date.now(),
        path: body.path || '',
        ref: body.ref || '',
        sponsorPresent: body.sponsorPresent || false,
        ipHash: ipHash,
        userAgent: (req.headers['user-agent'] || '').substring(0, 200), // Truncate for storage
        // Additional analytics fields
        ...Object.keys(body)
          .filter(key => !['e', 'path', 'ref', 'sponsorPresent'].includes(key))
          .reduce((obj, key) => {
            obj[key] = body[key];
            return obj;
          }, {})
      };

      // Store in Firestore with auto-generated ID
      await db.collection('_webEvents').add(eventDoc);

      // Log for debugging (structured for Cloud Logging)
      console.log('📊 TBP Analytics Event', {
        event: body.e,
        sponsorPresent: body.sponsorPresent,
        ref: body.ref,
        path: body.path
      });

      return res.status(204).end();
    } catch (error) {
      console.error('❌ Error logging analytics event:', error);
      // Always return 204 to avoid blocking web flow
      return res.status(204).end();
    }
  });
});

module.exports = {
  tbpEventLog
};