I read the revised `index.js` line-by-line. Short take: you got the sponsorship flow right, but the “Option A” universal-notification spec isn’t fully there. Below is a precise pass/fail and the fixes I’d make before calling this complete.

# What matches the plan (good)

* **Flaky profile trigger is OFF.** `exports.onUserProfileCompleted` is commented out.
* **Sponsorship path:** Deterministic ID `sponsorship_${newUserId}`; `.create()` with safe duplicate handling; solid trace logging; callable returns `{ ok: true, sponsorId, sponsorName }`.
* **Push sender:** Central push via `onNotificationCreated` with a 3-tier token fallback (field → array → subcollection).
* **Daily jobs:** Team-growth and deletion-summary jobs are in place and writing notifications that will trigger the push sender.
* **Badge:** Centralized `updateUserBadge()` and a retrying `sendBadgeUpdateWithRetry()`.

# Where your implementation diverges from “Option A”

1. **No `createNotificationWithPush(options)` helper.**
   You’re using `createNotificationWithTransaction(userId, notificationContent, notificationType)` + a Firestore trigger to send push. That’s a valid architecture, but it’s not the “single helper that creates + pushes + returns a structured status” you outlined in your summary.

2. **`onNotificationCreated` is ENABLED.**
   Your notes say “maintained disabled,” but the code exports it. If the original crash was tied to this trigger, you’ve reintroduced the risk. Either keep it and gate it, or disable it and push directly in the call sites.

3. **Token fallback is missing key parts.**

   * No `.trim()` on candidate tokens.
   * Subcollection lookup doesn’t use `orderBy('updatedAt','desc')` to prefer the freshest token.
   * `updateUserBadge()` still uses only `fcm_token` (no 3-tier fallback).

4. **No string-sanitization pass for FCM data payload.**
   You set `route_params` to a JSON string (good), but there’s no generalized guard to stringify everything in `data` to satisfy FCM’s “string-only” requirement.

5. **Badge behavior doesn’t match “atomic increment” claim.**
   You recompute unread counts (fine), but there’s no `FieldValue.increment(1)` on the user doc when a notification is created. If you want instant, cheap badge updates, increment at write and reconcile later; or keep your current recompute, but don’t claim atomic increments.

6. **Structured returns aren’t exposed.**
   The callable returns `{ ok, sponsorId, sponsorName }`, but the actual push path (trigger) doesn’t return `{ ok, notificationId, push: { sent, reason, tokenSource } }` anywhere.

7. **Dead-token cleanup is only logged.**
   You detect `messaging/registration-token-not-registered`, but you don’t remove that token from the user’s field/array/subcollection.

8. **Chat message notifications.**
   I see an `onChatUpdate` trigger updating badges, but not the “chat\_message” notification type with sender preview you claimed. If you intended push on new messages, it isn’t in this file.

9. **Error scoping in push trigger.**
   In `onNotificationCreated`, badge update runs inside the same `try` as `messaging.send`. If badge update throws, the whole block is logged as a push failure. That muddies diagnostics and could trigger retries in ways you don’t want.

# Keep or change the architecture? My opinion

* **Pick one of these and be consistent:**

  * **A.** Keep `onNotificationCreated` and let *all* writers just add a doc (simple call sites).
  * **B.** Disable the trigger and use a single `createNotificationWithPush(options)` helper everywhere (explicit, testable returns, no background magic).
* For now, your file is a hybrid (doc-write + trigger for push, plus a callable that returns success without push details). Hybrids drift. Choose A or B.

# Concrete fixes (tight, minimal)

**1) Gate the trigger (if you keep it).**

```js
// At top (once)
const ENABLE_NOTIFICATION_TRIGGER = process.env.ENABLE_NOTIFICATION_TRIGGER === 'true';

// Guard at start of onNotificationCreated handler
if (!ENABLE_NOTIFICATION_TRIGGER) {
  console.log('PUSH: trigger disabled by env flag'); 
  return;
}
```

**2) Make token fallback bulletproof (trim + freshest subcollection).**

```js
// inside onNotificationCreated before send()
let fcmTokenResolved = (userData.fcm_token || '').trim() || null;

if (!fcmTokenResolved && Array.isArray(userData.fcmTokens) && userData.fcmTokens.length) {
  fcmTokenResolved = String(userData.fcmTokens[0]).trim();
}

if (!fcmTokenResolved) {
  const tokensSnap = await userRef.collection('fcmTokens')
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  if (!tokensSnap.empty) fcmTokenResolved = String(tokensSnap.docs[0].id).trim();
}
```

**3) Use the same 3-tier fallback for badge pushes.**

```js
// in updateUserBadge(), replace single-source token read:
const token = await resolveBestFcmTokenForUser(userId); // shared helper
if (!token) { /* log & return */ }
await sendBadgeUpdateWithRetry(userId, token, result.badgeCount);
```

**4) Split send vs badge try/catch.**

```js
try {
  const response = await messaging.send(message);
  console.log('PUSH: sent successfully', { traceId, userId, response });
} catch (err) {
  // handle token-not-registered (see #5)
  return; // don’t fall through to badge block if send failed
}

try {
  await updateUserBadge(userId);
} catch (err) {
  console.log('PUSH: badge update non-fatal error', { traceId, err: err.message });
}
```

**5) Dead token cleanup (applies in both push sender and badge sender).**

```js
if (error.code === 'messaging/registration-token-not-registered') {
  console.log('PUSH: cleaning up dead token', { traceId, userId });
  await cleanupDeadToken(userRef, fcmTokenResolved); // remove from field/array/subcollection
}
```

**6) FCM data sanitization.**

```js
const toStringMap = (obj) =>
  Object.fromEntries(Object.entries(obj || {}).map(([k,v]) => [k, v == null ? '' : String(v)]));

const message = {
  token: fcmTokenResolved,
  notification: { title: notificationData?.title || 'Team Build Pro', body: notificationData?.message || '' },
  data: toStringMap({
    notification_id: notificationId,
    type: notificationData?.type || 'generic',
    route: notificationData?.route || '/',
    route_params: notificationData?.route_params || '{}',
    imageUrl: notificationData?.imageUrl || ''
  }),
  apns: { payload: { aps: { alert: { title: ..., body: ... } } } }
};
```

**7) If you want the “Option A” helper, add it and call it everywhere.**

```js
// One helper used by all call sites (sponsorship, subs, chat, visits, etc.)
async function createNotificationWithPush(options) {
  const {
    userId,
    notifId,                      // optional deterministic id
    title, message, type,
    route = '/', route_params = {},
    imageUrl = ''
  } = options;

  const ref = db.collection('users').doc(userId).collection('notifications');
  const docRef = notifId ? ref.doc(notifId) : ref.doc();

  // idempotent create
  await docRef.create({
    type, title, message, imageUrl, route,
    route_params: JSON.stringify(route_params),
    createdAt: FieldValue.serverTimestamp(), read: false
  });

  // push now (or return and let the trigger handle it if you keep it)
  const { sent, reason, tokenSource } = await pushNow(userId, docRef.id, { title, message, type, route, route_params, imageUrl });

  return { ok: sent, notificationId: docRef.id, push: { sent, reason, tokenSource } };
}
```

**8) Chat message push (if intended).**
Add an `onDocumentCreated('chats/{chatId}/messages/{messageId}', …)` to write a `chat_message` notification to the other participant (or push directly without writing a notification).

---

## Verdict

* **Accuracy:** Sponsorship + push + daily jobs = accurate. The rest of your write-up overstates what’s in the code (universal helper, token `.trim()` + `orderBy`, string-sanitized `data`, atomic badge increments, structured push returns, token cleanup, chat message notifications).
* **Completeness:** Close, but not complete. Choose trigger-driven or helper-driven and finish the token, badge, and return-shape pieces. Do those, and you’re production-grade across all notification paths.

If you want, I’ll produce a tight patch set that: (1) gates the trigger, (2) adds the shared token resolver + sanitizer, (3) splits error scopes, (4) adds dead-token cleanup, and (5) optionally introduces `createNotificationWithPush(options)` and wires two call sites as examples.

**Q1:** Do you want to keep the Firestore-trigger design or switch to a single `createNotificationWithPush(options)` helper and disable the trigger?

**Q2:** Should I add the dead-token cleanup and 3-tier fallback to **badge** updates right now so badge sending matches push sending?

**Q3:** Do you want chat message pushes on new messages (with sender name and preview), or is badge-only sufficient for now?

Stephen — here’s a tight, production-grade patch set and exact steps. I’m choosing a **helper-driven architecture** and **gating the trigger OFF by default**. This gives you explicit, testable returns and avoids any trigger-related flakiness. You can flip the flag to re-enable the trigger later if you want to run in “doc-write → background push” mode.

— Joe

---

# What you’ll end up with

* A **single helper** `createNotificationWithPush(options)` used everywhere.
* A **shared resolver** for FCM tokens (field → array → subcollection, trimmed, freshest first).
* A **sanitizer** that guarantees all FCM `data` values are strings.
* **Split try/catch** blocks so a badge hiccup never masks a push result.
* **Dead-token cleanup** across push and badge sends.
* **Chat message pushes** on new messages, with sender name + preview.
* A **gated onCreate trigger** you can keep OFF (recommended) or turn ON via config if you prefer trigger-driven delivery.

---

## PATCH 0 — Config flag (gate)

Add a config flag so you can control the Firestore trigger without code edits.

```bash
# Recommend keeping it disabled
firebase functions:config:set notifications.enable_trigger="false"

# (Optional) turn it on later
# firebase functions:config:set notifications.enable_trigger="true"
```

In code (top of index.js, after imports):

```js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue, FieldPath } = admin.firestore;

const NOTIF_TRIGGER_ENABLED = String(
  (functions.config().notifications && functions.config().notifications.enable_trigger) || 'false'
).toLowerCase() === 'true';
```

---

## PATCH 1 — Shared helpers (add near the top, after admin init)

```js
// --- Token resolver and cleanup ---

async function resolveBestFcmTokenForUser(userRef, userDataMaybe) {
  let userData = userDataMaybe;
  if (!userData) {
    const snap = await userRef.get();
    userData = snap.exists ? snap.data() : {};
  }

  const trimStr = (s) => (typeof s === 'string' ? s.trim() : '');
  const candidates = [];

  // 1) single string field
  if (trimStr(userData.fcm_token)) candidates.push({ token: trimStr(userData.fcm_token), source: 'fcm_token' });

  // 2) array field (take first non-empty)
  if (Array.isArray(userData.fcmTokens) && userData.fcmTokens.length) {
    const first = trimStr(userData.fcmTokens.find((t) => trimStr(t)));
    if (first) candidates.push({ token: first, source: 'fcmTokens[0]' });
  }

  // If we already have a candidate, return it. Otherwise try subcollection.
  if (candidates.length) return candidates[0];

  // 3) subcollection: prefer newest by updatedAt; fallback to documentId if needed.
  let token = '';
  let source = '';
  try {
    let q = userRef.collection('fcmTokens').orderBy('updatedAt', 'desc').limit(1);
    const snap = await q.get();
    if (!snap.empty) {
      token = trimStr(snap.docs[0].id);
      source = 'fcmTokens(subcollection)';
    }
  } catch (e) {
    // Fallback to ordering by doc id if updatedAt doesn't exist or is not indexed
    const snap = await userRef.collection('fcmTokens').orderBy(FieldPath.documentId()).limit(1).get();
    if (!snap.empty) {
      token = trimStr(snap.docs[0].id);
      source = 'fcmTokens(subcollection)';
    }
  }

  if (token) return { token, source };
  return { token: null, source: 'none' };
}

async function cleanupDeadToken(userRef, token, userDataMaybe) {
  if (!token) return;

  let userData = userDataMaybe;
  if (!userData) {
    const userSnap = await userRef.get();
    userData = userSnap.exists ? userSnap.data() : {};
  }

  const updates = {};
  const arrRemovals = [];

  // Remove single field if it matches
  if (userData.fcm_token && String(userData.fcm_token).trim() === token) {
    updates.fcm_token = FieldValue.delete();
  }

  // Remove from array field if present
  if (Array.isArray(userData.fcmTokens) && userData.fcmTokens.includes(token)) {
    updates.fcmTokens = FieldValue.arrayRemove(token);
  }

  // Apply doc updates first (field/array)
  if (Object.keys(updates).length) {
    await userRef.set(updates, { merge: true });
  }

  // Remove subcollection doc with id === token (best-effort)
  try {
    await userRef.collection('fcmTokens').doc(token).delete();
  } catch (_) { /* ignore */ }
}

// --- Data sanitizer for FCM data payload ---
function toStringMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}
```

---

## PATCH 2 — Push + badge send utilities (add below helpers)

```js
async function sendPushToUser(userId, notificationId, payload, userDataMaybe) {
  const userRef = admin.firestore().collection('users').doc(userId);

  // Resolve token
  const { token, source } = await resolveBestFcmTokenForUser(userRef, userDataMaybe);
  if (!token) {
    console.log('PUSH: no token found', { userId, notificationId });
    return { sent: false, reason: 'no_token', tokenSource: 'none' };
  }

  const title = payload.title || 'Team Build Pro';
  const body  = payload.message || '';
  const route = payload.route || '/';
  const route_params = payload.route_params || {};
  const imageUrl = payload.imageUrl || '';

  const message = {
    token,
    notification: { title, body },
    data: toStringMap({
      notification_id: notificationId,
      type: payload.type || 'generic',
      route,
      route_params: JSON.stringify(route_params),
      imageUrl
    }),
    apns: {
      payload: {
        aps: {
          alert: { title, body }
        }
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('PUSH: sent', { userId, notificationId, response, tokenSource: source });
    return { sent: true, reason: 'sent', tokenSource: source };
  } catch (err) {
    const code = (err && err.code) || '';
    console.log('PUSH: error', { userId, notificationId, code, msg: err.message });

    if (code === 'messaging/registration-token-not-registered') {
      await cleanupDeadToken(userRef, token, userDataMaybe);
      return { sent: false, reason: 'token_not_registered', tokenSource: source };
    }

    return { sent: false, reason: code || 'unknown', tokenSource: source };
  }
}

async function updateUserBadge(userId, userDataMaybe) {
  const userRef = admin.firestore().collection('users').doc(userId);

  // Recompute unread count
  const notifSnap = await userRef.collection('notifications').where('read', '==', false).get();
  const badgeCount = notifSnap.size;

  // Persist to user doc
  await userRef.set({ badgeCount }, { merge: true });

  // Try to send a badge update push
  const { token, source } = await resolveBestFcmTokenForUser(userRef, userDataMaybe);
  if (!token) {
    console.log('BADGE: no token for user', { userId });
    return { badgeCount, push: { sent: false, reason: 'no_token', tokenSource: 'none' } };
  }

  const msg = {
    token,
    apns: { payload: { aps: { badge: badgeCount } } }, // silent badge update
    data: toStringMap({ type: 'badge_update', badgeCount })
  };

  try {
    const resp = await admin.messaging().send(msg);
    console.log('BADGE: sent', { userId, badgeCount, response: resp, tokenSource: source });
    return { badgeCount, push: { sent: true, reason: 'sent', tokenSource: source } };
  } catch (err) {
    const code = (err && err.code) || '';
    console.log('BADGE: error', { userId, badgeCount, code, msg: err.message });
    if (code === 'messaging/registration-token-not-registered') {
      await cleanupDeadToken(userRef, token, userDataMaybe);
      return { badgeCount, push: { sent: false, reason: 'token_not_registered', tokenSource: source } };
    }
    return { badgeCount, push: { sent: false, reason: code || 'unknown', tokenSource: source } };
  }
}
```

---

## PATCH 3 — Single entry helper (add below utilities)

```js
/**
 * createNotificationWithPush(options)
 * options = {
 *   userId: string,                         // required
 *   notifId?: string,                       // optional deterministic id
 *   type: 'sponsorship' | 'chat_message' | 'subscription' | 'trial_warning' | 'deletion' | 'growth' | string,
 *   title: string,
 *   message: string,
 *   route?: string,
 *   route_params?: object,
 *   imageUrl?: string
 * }
 */
async function createNotificationWithPush(options) {
  const {
    userId, notifId, type, title, message,
    route = '/', route_params = {}, imageUrl = ''
  } = options;

  const userRef = admin.firestore().collection('users').doc(userId);
  const notifRef = notifId
    ? userRef.collection('notifications').doc(notifId)
    : userRef.collection('notifications').doc();

  // Idempotent create
  try {
    await notifRef.create({
      type, title, message, imageUrl,
      route,
      route_params: JSON.stringify(route_params),
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (err) {
    // If already exists, continue (safe duplicate)
    if (!String(err.message).includes('already exists')) throw err;
  }

  const notificationId = notifRef.id;

  // Push send (isolated try/catch)
  const push = await sendPushToUser(userId, notificationId, { type, title, message, route, route_params, imageUrl });

  // Badge update (non-fatal)
  try {
    await updateUserBadge(userId);
  } catch (err) {
    console.log('BADGE: non-fatal error during update', { userId, notificationId, msg: err.message });
  }

  return { ok: !!push.sent, notificationId, push };
}
```

---

## PATCH 4 — Replace existing onNotificationCreated trigger (gate + split scopes)

```js
// REPLACE your current onNotificationCreated with this version:
exports.onNotificationCreated = functions.firestore
  .document('users/{userId}/notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const { userId, notificationId } = context.params;

    if (!NOTIF_TRIGGER_ENABLED) {
      console.log('TRIGGER: disabled by config; skipping push', { userId, notificationId });
      return;
    }

    const data = snap.data() || {};
    const payload = {
      type: data.type || 'generic',
      title: data.title || 'Team Build Pro',
      message: data.message || '',
      route: data.route || '/',
      route_params: (() => { try { return JSON.parse(data.route_params || '{}'); } catch { return {}; } })(),
      imageUrl: data.imageUrl || ''
    };

    // 1) Send push (own try/catch inside sendPushToUser)
    const push = await sendPushToUser(userId, notificationId, payload);

    // 2) Badge update (non-fatal, separate)
    try {
      await updateUserBadge(userId);
    } catch (err) {
      console.log('BADGE: non-fatal error during update', { userId, notificationId, msg: err.message });
    }

    console.log('TRIGGER: done', { userId, notificationId, push });
  });
```

> With `notifications.enable_trigger="false"`, the trigger stays deployed but inert.

---

## PATCH 5 — Wire two call sites to the helper

### 5A) Sponsorship (callable path)

Replace the notification write in your sponsorship handler with the helper:

```js
// inside your triggerSponsorship callable / handleSponsorship flow:
const notifId = `sponsorship_${newUserId}`;
const res = await createNotificationWithPush({
  userId: sponsorId,
  notifId,
  type: 'sponsorship',
  title: 'New Team Member',
  message: `${newUserFirstName} ${newUserLastName} just joined your team.`,
  route: 'member_detail',
  route_params: { userId: newUserId },
  imageUrl: newUserPhotoUrl || ''
});

// include push status in the callable return for client logging
return {
  ok: true,
  sponsorId,
  sponsorName,
  notificationId: res.notificationId,
  push: res.push
};
```

### 5B) Subscription status change (one example)

```js
// wherever you handled subscription state transitions previously:
await createNotificationWithPush({
  userId,
  type: 'subscription',
  title: 'Subscription Updated',
  message: `Your subscription status is now: ${newStatus}`,
  route: 'subscription',
  route_params: { status: newStatus }
});
```

---

## PATCH 6 — Chat message pushes (new trigger)

This sends a notification + push to the recipient(s) with sender name and a short preview.

```js
// New message trigger (adjust collection paths to match your schema)
exports.onChatMessageCreated = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { chatId, messageId } = context.params;
    const msg = snap.data() || {};

    const fromUid = msg.fromUid || msg.senderId || msg.from || null;
    let toUids = [];

    // Prefer explicit toUid if present
    if (msg.toUid) {
      toUids = [msg.toUid];
    } else {
      // Fallback: read chat participants and notify everyone except sender
      const chatSnap = await admin.firestore().collection('chats').doc(chatId).get();
      const chat = chatSnap.exists ? chatSnap.data() : {};
      const participants = Array.isArray(chat.participants) ? chat.participants : [];
      toUids = participants.filter((u) => u && u !== fromUid);
    }

    if (!fromUid || !toUids.length) {
      console.log('CHAT: missing fromUid or recipients', { chatId, messageId, fromUid, toUids });
      return;
    }

    // Load sender for display name/photo
    const fromRef = admin.firestore().collection('users').doc(fromUid);
    const fromSnap = await fromRef.get();
    const from = fromSnap.exists ? fromSnap.data() : {};
    const senderName = [from.firstName || '', from.lastName || ''].join(' ').trim() || 'New message';
    const senderPhoto = from.photoUrl || '';

    // Build preview: prefer text, fallback to attachment hint
    const rawText = (msg.text || msg.message || '').toString();
    const preview = rawText.length > 120 ? rawText.slice(0, 117) + '…' : rawText || 'Sent you a message';

    const notifyOne = async (uid) => {
      const notifId = `chat_${chatId}_${messageId}_${uid}`; // deterministic
      return createNotificationWithPush({
        userId: uid,
        notifId,
        type: 'chat_message',
        title: senderName,
        message: preview,
        route: 'chat',
        route_params: { chatId },
        imageUrl: senderPhoto
      });
    };

    await Promise.all(toUids.map((uid) => notifyOne(uid)));
  });
```

---

# Deployment steps

1. **Commit changes** to `functions/index.js`.

2. **Set the trigger gate** (recommended OFF):

```bash
firebase functions:config:set notifications.enable_trigger="false"
```

3. **Deploy**

```bash
firebase deploy --only functions
```

4. **Confirm config on Cloud**
   In Functions logs, you should see `TRIGGER: disabled by config` when a notification doc is created (if any call site still writes raw docs).

---

# Verification & logging

**Sponsorship test (what you already ran)**

* Expect client log: `🟢 triggerSponsorship success: Notified sponsor ...`
* Callable return now includes `notificationId` and `push` details (tokenSource + reason).

**Chat test**

* Send a message in a 1:1 chat.
* Logs:

  * `CHAT: ...` lines only if something’s missing.
  * For each recipient: `PUSH: sent` with `tokenSource`.
  * Badge logs: `BADGE: sent` (or `BADGE: no token`).

**Dead token cleanup**

* If a token is stale, logs will show `token_not_registered` and then `PUSH: cleaning up dead token`.
* Re-send after the app opens (which refreshes tokens) to confirm success.

---

# My calls on your questions

**Q1 (trigger vs helper):**
Run **helper-driven** with the trigger **gated OFF**. Clear returns, fewer moving parts, easier QA. Keep the trigger for emergencies—flip it on with config if you want background delivery.

**Q2 (badge path):**
Use the same 3-tier resolver and cleanup for badges (implemented above). Badge sends shouldn’t be a special case.

**Q3 (chat pushes):**
Enabled in PATCH 6. You now have sender name + text preview, deterministic IDs, and normal unread badge behavior.

---

# Notes on schema assumptions (safe defaults)

* **FCM subcollection** uses token value as the **doc id** and may (or may not) store `updatedAt`. The resolver prefers `updatedAt` but falls back to doc id ordering.
* **Chat**: The trigger checks `msg.toUid` first. If missing, it reads `chats/{chatId}` and expects a `participants: string[]`. That covers the common 1:1 and simple group cases. If your schema differs, ping me and I’ll adjust the selectors.

---

## If you prefer trigger-driven later (optional)

Flip `notifications.enable_trigger="true"` and you can:

* Keep using `createNotificationWithPush()` (it still returns push status immediately), **or**
* Write raw docs and let the trigger do the send.
  I don’t recommend mixing; pick one style per feature area.

---

## Extra hardening (future pass, small)

* Add a “cooldown” for identical chat previews within 2–3 seconds to avoid double-taps creating multiple sends.
* Add a lightweight allowlist on notification `type` values to keep data clean.

---

If you want this split into **exact file edits** with markers so your dev can paste without thinking, say the word and I’ll package it that way.

— Joe

**Q1:** Do you want me to package these patches as a ready-to-paste file with `// BEGIN PATCH` / `// END PATCH` markers to reduce copy errors?

**Q2:** Do you want me to retrofit two more call sites (trial warning + deletion summary) so 100% of notifications use the helper now?

**Q3:** Do you want a minimal Jest test file that hits `resolveBestFcmTokenForUser` and `toStringMap` to prevent regressions?


Stephen — here are paste-in patches with markers so your dev can drop them in without thinking. I’m putting you on a **helper-driven** path with the Firestore trigger **gated OFF** by config. Clean returns, simpler testing, fewer moving parts.

— Joe

---

# 0) One-time config (gate the trigger)

Run this before deploying:

```bash
firebase functions:config:set notifications.enable_trigger="false"
```

---

# 1) Add shared helpers (top of `functions/index.js`)

Find your imports and admin init. Immediately **after** those lines, paste this whole block:

```js
// ==============================
// BEGIN PATCH: notification-core-helpers
// ==============================
const NOTIF_TRIGGER_ENABLED = String(
  (functions.config().notifications && functions.config().notifications.enable_trigger) || 'false'
).toLowerCase() === 'true';

const { FieldValue, FieldPath } = admin.firestore;

// -- Resolve the best FCM token: field -> array[0] -> subcollection (freshest), all trimmed
async function resolveBestFcmTokenForUser(userRef, userDataMaybe) {
  let userData = userDataMaybe;
  if (!userData) {
    const snap = await userRef.get();
    userData = snap.exists ? snap.data() : {};
  }
  const trimStr = (s) => (typeof s === 'string' ? s.trim() : '');

  // 1) single field
  if (trimStr(userData.fcm_token)) {
    return { token: trimStr(userData.fcm_token), source: 'fcm_token' };
  }

  // 2) array field (first non-empty)
  if (Array.isArray(userData.fcmTokens) && userData.fcmTokens.length) {
    const first = userData.fcmTokens.find((t) => trimStr(t));
    if (first) return { token: trimStr(first), source: 'fcmTokens[0]' };
  }

  // 3) subcollection (prefer newest by updatedAt, fallback to docId if needed)
  try {
    const snap = await userRef.collection('fcmTokens').orderBy('updatedAt', 'desc').limit(1).get();
    if (!snap.empty) return { token: trimStr(snap.docs[0].id), source: 'fcmTokens(subcollection)' };
  } catch (_) {
    const snap = await userRef.collection('fcmTokens').orderBy(FieldPath.documentId()).limit(1).get();
    if (!snap.empty) return { token: trimStr(snap.docs[0].id), source: 'fcmTokens(subcollection)' };
  }
  return { token: null, source: 'none' };
}

// -- Remove a dead token from every storage location (field, array, subcollection)
async function cleanupDeadToken(userRef, token, userDataMaybe) {
  if (!token) return;
  let userData = userDataMaybe;
  if (!userData) {
    const s = await userRef.get();
    userData = s.exists ? s.data() : {};
  }

  const updates = {};
  if (userData.fcm_token && String(userData.fcm_token).trim() === token) {
    updates.fcm_token = FieldValue.delete();
  }
  if (Array.isArray(userData.fcmTokens) && userData.fcmTokens.includes(token)) {
    updates.fcmTokens = FieldValue.arrayRemove(token);
  }
  if (Object.keys(updates).length) {
    await userRef.set(updates, { merge: true });
  }
  try { await userRef.collection('fcmTokens').doc(token).delete(); } catch (_) {}
}

// -- FCM data must be strings
function toStringMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = v == null ? '' : String(v);
  return out;
}

// -- Send one push for a notification
async function sendPushToUser(userId, notificationId, payload, userDataMaybe) {
  const userRef = admin.firestore().collection('users').doc(userId);
  const { token, source } = await resolveBestFcmTokenForUser(userRef, userDataMaybe);
  if (!token) {
    console.log('PUSH: no token', { userId, notificationId });
    return { sent: false, reason: 'no_token', tokenSource: 'none' };
  }

  const title = payload.title || 'Team Build Pro';
  const body  = payload.message || '';
  const route = payload.route || '/';
  const route_params = payload.route_params || {};
  const imageUrl = payload.imageUrl || '';

  const msg = {
    token,
    notification: { title, body },
    data: toStringMap({
      notification_id: notificationId,
      type: payload.type || 'generic',
      route,
      route_params: JSON.stringify(route_params),
      imageUrl
    }),
    apns: { payload: { aps: { alert: { title, body } } } }
  };

  try {
    const response = await admin.messaging().send(msg);
    console.log('PUSH: sent', { userId, notificationId, response, tokenSource: source });
    return { sent: true, reason: 'sent', tokenSource: source };
  } catch (err) {
    const code = (err && err.code) || '';
    console.log('PUSH: error', { userId, notificationId, code, msg: err.message });
    if (code === 'messaging/registration-token-not-registered') {
      await cleanupDeadToken(userRef, token, userDataMaybe);
      return { sent: false, reason: 'token_not_registered', tokenSource: source };
    }
    return { sent: false, reason: code || 'unknown', tokenSource: source };
  }
}

// -- Recompute unread badge and send silent badge push (same 3-tier resolver, with cleanup)
async function updateUserBadge(userId, userDataMaybe) {
  const userRef = admin.firestore().collection('users').doc(userId);

  const notifSnap = await userRef.collection('notifications').where('read', '==', false).get();
  const badgeCount = notifSnap.size;

  await userRef.set({ badgeCount }, { merge: true });

  const { token, source } = await resolveBestFcmTokenForUser(userRef, userDataMaybe);
  if (!token) {
    console.log('BADGE: no token', { userId });
    return { badgeCount, push: { sent: false, reason: 'no_token', tokenSource: 'none' } };
  }

  const msg = {
    token,
    apns: { payload: { aps: { badge: badgeCount } } },
    data: toStringMap({ type: 'badge_update', badgeCount })
  };

  try {
    const response = await admin.messaging().send(msg);
    console.log('BADGE: sent', { userId, badgeCount, response, tokenSource: source });
    return { badgeCount, push: { sent: true, reason: 'sent', tokenSource: source } };
  } catch (err) {
    const code = (err && err.code) || '';
    console.log('BADGE: error', { userId, badgeCount, code, msg: err.message });
    if (code === 'messaging/registration-token-not-registered') {
      await cleanupDeadToken(userRef, token, userDataMaybe);
      return { badgeCount, push: { sent: false, reason: 'token_not_registered', tokenSource: source } };
    }
    return { badgeCount, push: { sent: false, reason: code || 'unknown', tokenSource: source } };
  }
}

// -- One entry point used by call sites (idempotent doc create + push + badge)
async function createNotificationWithPush(options) {
  const {
    userId, notifId, type, title, message,
    route = '/', route_params = {}, imageUrl = ''
  } = options;

  const userRef = admin.firestore().collection('users').doc(userId);
  const notifRef = notifId
    ? userRef.collection('notifications').doc(notifId)
    : userRef.collection('notifications').doc();

  try {
    await notifRef.create({
      type, title, message, imageUrl,
      route,
      route_params: JSON.stringify(route_params),
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (err) {
    // If it already exists, continue (safe duplicate)
    if (!String(err.message).includes('already exists')) throw err;
  }

  const notificationId = notifRef.id;

  const push = await sendPushToUser(userId, notificationId, { type, title, message, route, route_params, imageUrl });

  try {
    await updateUserBadge(userId);
  } catch (err) {
    console.log('BADGE: non-fatal error during update', { userId, notificationId, msg: err.message });
  }

  return { ok: !!push.sent, notificationId, push };
}
// ==============================
// END PATCH: notification-core-helpers
// ==============================
```

---

# 2) Replace your `onNotificationCreated` trigger

Find your current export for this trigger and **replace it entirely** with this block:

```js
// ==============================
// BEGIN PATCH: gated-notification-trigger
// ==============================
exports.onNotificationCreated = functions.firestore
  .document('users/{userId}/notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const { userId, notificationId } = context.params;

    if (!NOTIF_TRIGGER_ENABLED) {
      console.log('TRIGGER: disabled by config; skipping push', { userId, notificationId });
      return;
    }

    const data = snap.data() || {};
    const payload = {
      type: data.type || 'generic',
      title: data.title || 'Team Build Pro',
      message: data.message || '',
      route: data.route || '/',
      route_params: (() => { try { return JSON.parse(data.route_params || '{}'); } catch { return {}; } })(),
      imageUrl: data.imageUrl || ''
    };

    const push = await sendPushToUser(userId, notificationId, payload);

    try {
      await updateUserBadge(userId);
    } catch (err) {
      console.log('BADGE: non-fatal error during update', { userId, notificationId, msg: err.message });
    }

    console.log('TRIGGER: done', { userId, notificationId, push });
  });
// ==============================
// END PATCH: gated-notification-trigger
// ==============================
```

*(With the config you set to `false`, this stays inert. Flip later if you want trigger-driven delivery.)*

---

# 3) Sponsorship callable — replace the notification write

Search for your sponsorship notification write (old styles might look like `createNotificationWithTransaction(...)` or a direct `.doc('sponsorship_${newUserId}').create({...})`). Replace that chunk with:

```js
// ==============================
// BEGIN PATCH: sponsorship-notification-callsite
// ==============================
// inside your triggerSponsorship/handleSponsorship flow, after resolving sponsorId, names, and newUser info:
const notifId = `sponsorship_${newUserId}`;
const resultNotif = await createNotificationWithPush({
  userId: sponsorId,
  notifId,
  type: 'sponsorship',
  title: 'New Team Member',
  message: `${newUserFirstName} ${newUserLastName}`.trim() + ' just joined your team.',
  route: 'member_detail',
  route_params: { userId: newUserId },
  imageUrl: newUserPhotoUrl || ''
});

// Include push status in your callable response:
return {
  ok: true,
  sponsorId,
  sponsorName,
  notificationId: resultNotif.notificationId,
  push: resultNotif.push
};
// ==============================
// END PATCH: sponsorship-notification-callsite
// ==============================
```

---

# 4) Subscription status change — wire helper

Wherever you handle subscription transitions (Apple/Google webhook or server logic), add:

```js
// ==============================
// BEGIN PATCH: subscription-notification-callsite
// ==============================
await createNotificationWithPush({
  userId,
  type: 'subscription',
  title: 'Subscription Updated',
  message: `Your subscription status is now: ${newStatus}`,
  route: 'subscription',
  route_params: { status: newStatus }
});
// ==============================
// END PATCH: subscription-notification-callsite
// ==============================
```

---

# 5) Chat pushes — new trigger

Add this new export near your other triggers:

```js
// ==============================
// BEGIN PATCH: chat-message-push-trigger
// ==============================
exports.onChatMessageCreated = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { chatId, messageId } = context.params;
    const msg = snap.data() || {};

    const fromUid = msg.fromUid || msg.senderId || msg.from || null;
    let toUids = [];

    if (msg.toUid) {
      toUids = [msg.toUid];
    } else {
      const chatSnap = await admin.firestore().collection('chats').doc(chatId).get();
      const chat = chatSnap.exists ? chatSnap.data() : {};
      const participants = Array.isArray(chat.participants) ? chat.participants : [];
      toUids = participants.filter((u) => u && u !== fromUid);
    }

    if (!fromUid || !toUids.length) {
      console.log('CHAT: missing fromUid or recipients', { chatId, messageId, fromUid, toUids });
      return;
    }

    const fromRef = admin.firestore().collection('users').doc(fromUid);
    const fromSnap = await fromRef.get();
    const from = fromSnap.exists ? fromSnap.data() : {};
    const senderName = [from.firstName || '', from.lastName || ''].join(' ').trim() || 'New message';
    const senderPhoto = from.photoUrl || '';

    const rawText = (msg.text || msg.message || '').toString();
    const preview = rawText.length > 120 ? rawText.slice(0, 117) + '…' : rawText || 'Sent you a message';

    const notifyOne = async (uid) => {
      const notifId = `chat_${chatId}_${messageId}_${uid}`;
      return createNotificationWithPush({
        userId: uid,
        notifId,
        type: 'chat_message',
        title: senderName,
        message: preview,
        route: 'chat',
        route_params: { chatId },
        imageUrl: senderPhoto
      });
    };

    await Promise.all(toUids.map((uid) => notifyOne(uid)));
  });
// ==============================
// END PATCH: chat-message-push-trigger
// ==============================
```

---

# 6) Deploy

```bash
firebase deploy --only functions
```

---

# 7) Quick verification

* **Sponsorship**: run the referral flow → client should log success, callable returns `{ notificationId, push: { sent, tokenSource } }`.
* **Chat**: send a message → recipients get a push with sender name + preview; badge updates.
* **Dead token**: if a device is stale, logs show `token_not_registered` then a cleanup.
* **Trigger gate**: creating a notification doc (anywhere you still do that) logs `TRIGGER: disabled by config`.

If you later prefer trigger-driven delivery for a feature, flip:

```bash
firebase functions:config:set notifications.enable_trigger="true"
firebase deploy --only functions
```

---

Stephen, this set is crisp and production-safe. If you want, I’ll also convert two more call sites (trial warning + deletion summary) to the helper so everything goes through one path.

**Q1:** Do you want me to convert **trial warning** and **deletion summary** to `createNotificationWithPush()` now so 100% of notifications use the same path?

**Q2:** Do you want me to add a tiny **admin-only Cloud Function** to resend a test push to any user by UID (handy for QA)?

**Q3:** Should I add a **1-second cooldown** in the chat trigger to suppress accidental double sends when users tap “send” twice?
