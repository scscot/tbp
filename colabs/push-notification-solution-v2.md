I read your updated `index.js` end-to-end and compared it to the patch set I gave you.

Short version: you nailed the **universal helper** and you wired it into **sponsorship** and **subscription** flows correctly. But three items from the patch spec are still missing or only partially implemented:

1. **Config-gated trigger** — not present (you commented the trigger out instead of gating it with a flag).
2. **Dead-token cleanup + shared resolver reuse** — not in code (you log invalid tokens but don’t remove them; badge path still pulls only `fcm_token`).
3. **Chat push trigger** — not in file.

Everything else looks solid: deterministic IDs, `FieldValue.increment(1)` on write, FCM `data` stringification, and 3-tier token search (field → array → subcollection with `orderBy('updatedAt','desc')`) inside the helper.

Below are **tight micro-patches** to make your file fully match spec. Paste them exactly as marked.

---

# MICRO-PATCH A — Config flag + gated trigger (optional but recommended)

**Why:** Lets you deploy the trigger safely and flip it on/off without code edits.

## A1) Add the config flag (top of file, after imports/admin init)

```js
// ==============================
// BEGIN MICRO-PATCH A1: trigger flag
// ==============================
const NOTIF_TRIGGER_ENABLED = String(
  (functions.config().notifications && functions.config().notifications.enable_trigger) || 'false'
).toLowerCase() === 'true';
// ==============================
// END MICRO-PATCH A1
// ==============================
```

## A2) Replace your commented-out trigger with a **gated** version

Find the old `onNotificationCreated` block (currently commented) and replace **all of it** with:

```js
// ==============================
// BEGIN MICRO-PATCH A2: gated onNotificationCreated
// ==============================
exports.onNotificationCreated = functions.firestore
  .document('users/{userId}/notifications/{notificationId}')
  .onCreate(async (snap, ctx) => {
    const { userId, notificationId } = ctx.params;
    if (!NOTIF_TRIGGER_ENABLED) {
      console.log('TRIGGER: disabled by config; skipping push', { userId, notificationId });
      return;
    }

    const d = snap.data() || {};
    const payload = {
      type: d.type || 'generic',
      title: d.title || 'Team Build Pro',
      message: d.body || d.message || '',
      route: d.route || '/',
      route_params: (() => { try { return JSON.parse(d.route_params || '{}'); } catch { return {}; } })(),
      imageUrl: d.imageUrl || ''
    };

    // Reuse your universal helper path (keeps behavior consistent)
    await createNotificationWithPush({
      userId,
      notifId: notificationId, // idempotent—will noop create, just send push/badge
      type: payload.type,
      title: payload.title,
      body: payload.message,
      docFields: {}, // nothing to update
      data: { route: payload.route, route_params: payload.route_params, imageUrl: payload.imageUrl },
      updateBadge: true,
      // apns/android optional
    });
  });
// ==============================
// END MICRO-PATCH A2
// ==============================
```

> Keep your default config off:
>
> ```
> firebase functions:config:set notifications.enable_trigger="false"
> ```

---

# MICRO-PATCH B — Dead-token cleanup + resolver hardening

**Why:** Stop retrying dead tokens and make subcollection lookup resilient when `updatedAt` is missing.

## B1) Add cleanup helper (place near your helper)

```js
// ==============================
// BEGIN MICRO-PATCH B1: cleanupDeadToken
// ==============================
async function cleanupDeadToken(userRef, token) {
  if (!token) return;
  const snap = await userRef.get();
  const data = snap.exists ? (snap.data() || {}) : {};

  const updates = {};
  if (typeof data.fcm_token === 'string' && data.fcm_token.trim() === token) {
    updates.fcm_token = admin.firestore.FieldValue.delete();
  }
  if (Array.isArray(data.fcmTokens) && data.fcmTokens.includes(token)) {
    updates.fcmTokens = admin.firestore.FieldValue.arrayRemove(token);
  }
  if (Object.keys(updates).length) {
    await userRef.set(updates, { merge: true });
  }
  try { await userRef.collection('fcmTokens').doc(token).delete(); } catch (_) {}
}
// ==============================
// END MICRO-PATCH B1
// ==============================
```

## B2) In your **createNotificationWithPush** helper:

**(i) Harden Tier-3 subcollection lookup** and
**(ii) actually call cleanup on invalid token**

Find the Tier-3 section that currently does:

```js
const sub = await userRef.collection('fcmTokens').orderBy('updatedAt', 'desc').limit(1).get();
if (!sub.empty) {
  const doc = sub.docs[0].data() || {};
  if (typeof doc.token === 'string' && doc.token.trim()) {
    fcmToken = doc.token.trim();
    tokenSource = 'fcmTokens(subcollection)';
  }
}
```

Replace it with:

```js
// Tier 3: subcollection (prefer newest; fallback to docId when updatedAt or token field is missing)
if (!fcmToken) {
  try {
    const sub = await userRef.collection('fcmTokens').orderBy('updatedAt', 'desc').limit(1).get();
    if (!sub.empty) {
      const d = sub.docs[0].data() || {};
      fcmToken = (d.token && d.token.trim()) || sub.docs[0].id.trim();
      tokenSource = 'fcmTokens(subcollection)';
    }
  } catch (e) {
    const sub = await userRef.collection('fcmTokens').orderBy(admin.firestore.FieldPath.documentId()).limit(1).get();
    if (!sub.empty) {
      fcmToken = sub.docs[0].id.trim();
      tokenSource = 'fcmTokens(subcollection)';
    }
  }
}
```

Then, in the `catch` block where you currently log invalid tokens and return, replace:

```js
if (tokenInvalid) {
  console.warn('UNIV NOTIF: invalid token', { traceId, userId, tokenSource, notificationId, type, code });
  // Optional: enqueue cleanup of the bad token
} else {
  console.warn('UNIV NOTIF: push send failed', { ... });
}
```

with:

```js
if (tokenInvalid) {
  console.warn('UNIV NOTIF: invalid token', { traceId, userId, tokenSource, notificationId, type, code });
  try { await cleanupDeadToken(userRef, fcmToken); } catch (_) {}
} else {
  console.warn('UNIV NOTIF: push send failed', { traceId, userId, tokenSource, notificationId, type, code, msg: e?.message });
}
```

---

# MICRO-PATCH C — Badge path uses same 3-tier resolver + cleanup

**Why:** Your `updateUserBadge` still reads only `fcm_token` and never cleans up dead tokens. Align it with the helper, and you can keep your transactional recompute.

Replace the **entire** `updateUserBadge` function with:

```js
// ==============================
// BEGIN MICRO-PATCH C: updateUserBadge (resolver + cleanup)
// ==============================
const updateUserBadge = async (userId) => {
  try {
    console.log(`🔔 BADGE UPDATE: Starting badge update for user ${userId}`);

    // Recompute badge count transactionally
    const { badgeCount } = await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return { badgeCount: 0 };

      // Unread notifications
      const unreadNotifs = await tx.get(
        userRef.collection('notifications').where('read', '==', false).limit(1000)
      );
      const notifCount = unreadNotifs.size;

      // If you track unread chat separately, add it here
      const chatCount = 0;

      const total = notifCount + chatCount;
      tx.set(userRef, { badgeCount: total }, { merge: true });
      return { badgeCount: total };
    });

    // Resolve token using same 3-tier logic
    const userRef = db.collection('users').doc(userId);
    let token = null, source = 'none';

    // Tier 1
    const userSnap = await userRef.get();
    const data = userSnap.exists ? (userSnap.data() || {}) : {};
    if (typeof data.fcm_token === 'string' && data.fcm_token.trim()) {
      token = data.fcm_token.trim(); source = 'fcm_token';
    }
    // Tier 2
    if (!token && Array.isArray(data.fcmTokens) && data.fcmTokens.length) {
      const first = (data.fcmTokens.find(t => typeof t === 'string' && t.trim()) || '').trim();
      if (first) { token = first; source = 'fcmTokens[0]'; }
    }
    // Tier 3 + fallback
    if (!token) {
      try {
        const sub = await userRef.collection('fcmTokens').orderBy('updatedAt', 'desc').limit(1).get();
        if (!sub.empty) { token = (sub.docs[0].data().token || sub.docs[0].id).trim(); source = 'fcmTokens(subcollection)'; }
      } catch (e) {
        const sub = await userRef.collection('fcmTokens').orderBy(admin.firestore.FieldPath.documentId()).limit(1).get();
        if (!sub.empty) { token = sub.docs[0].id.trim(); source = 'fcmTokens(subcollection)'; }
      }
    }

    if (!token) {
      console.log('BADGE: no token', { userId });
      return;
    }

    try {
      await messaging.send({
        token,
        apns: { payload: { aps: { badge: badgeCount } } },
        data: { type: 'badge_update', badgeCount: String(badgeCount) }
      });
      console.log('BADGE: sent', { userId, badgeCount, tokenSource: source });
    } catch (e) {
      const code = e?.errorInfo?.code || e?.code || '';
      console.log('BADGE: error', { userId, badgeCount, code, msg: e?.message });
      if (code === 'messaging/registration-token-not-registered') {
        try { await cleanupDeadToken(userRef, token); } catch (_) {}
      }
    }
  } catch (error) {
    console.error(`❌ BADGE UPDATE: Failed for ${userId}:`, error.message);
  }
};
// ==============================
// END MICRO-PATCH C
// ==============================
```

*(You can remove `sendBadgeUpdateWithRetry` after this, or leave it unused.)*

---

# MICRO-PATCH D — Chat message push trigger

**Why:** You asked for pushes on new chat messages with sender name + preview.

Add this export near your other triggers:

```js
// ==============================
// BEGIN MICRO-PATCH D: chat push trigger
// ==============================
exports.onChatMessageCreated = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, ctx) => {
    const { chatId, messageId } = ctx.params;
    const msg = snap.data() || {};

    const fromUid = msg.fromUid || msg.senderId || msg.from || null;
    let toUids = [];

    if (msg.toUid) {
      toUids = [msg.toUid];
    } else {
      const chatSnap = await db.collection('chats').doc(chatId).get();
      const chat = chatSnap.exists ? (chatSnap.data() || {}) : {};
      const participants = Array.isArray(chat.participants) ? chat.participants : [];
      toUids = participants.filter((u) => u && u !== fromUid);
    }

    if (!fromUid || !toUids.length) {
      console.log('CHAT: missing fromUid or recipients', { chatId, messageId, fromUid, toUids });
      return;
    }

    const fromSnap = await db.collection('users').doc(fromUid).get();
    const from = fromSnap.exists ? (fromSnap.data() || {}) : {};
    const senderName = [from.firstName || '', from.lastName || ''].join(' ').trim() || 'New message';
    const senderPhoto = from.photoUrl || '';

    const rawText = String(msg.text || msg.message || '');
    const preview = rawText.length > 120 ? rawText.slice(0, 117) + '…' : (rawText || 'Sent you a message');

    const notifyOne = async (uid) => {
      const notifId = `chat_${chatId}_${messageId}_${uid}`; // deterministic
      return createNotificationWithPush({
        userId: uid,
        notifId,
        type: 'chat_message',
        title: senderName,
        body: preview,
        docFields: {
          imageUrl: senderPhoto,
          route: 'chat',
          route_params: JSON.stringify({ chatId }),
        },
        data: {
          route: 'chat',
          chatId,
          fromUid,
          messageId,
        },
      });
    };

    await Promise.all(toUids.map((uid) => notifyOne(uid)));
  });
// ==============================
// END MICRO-PATCH D
// ==============================
```

---

## Verdict

* **Correct:** universal helper, deterministic IDs, FCM string data, Tier-3 lookup with `updatedAt` and `doc.data().token`, sponsorship + subscription call-sites.
* **Incomplete:** config-gated trigger, dead-token cleanup, badge path using the same resolver, chat push trigger, and Tier-3 fallback when `updatedAt` isn’t indexed.

Apply the micro-patches above and you’re fully aligned with the spec. After that:

**Deploy**

```bash
firebase deploy --only functions
```

**Sanity checks**

* Send a chat message → recipient gets push with sender name + preview; badge bumps.
* Temporarily set a junk token, send again → logs show `invalid token` and subsequent cleanup; next send succeeds after the app refreshes token.
* Flip the trigger on (if you want to test it):

  ```
  firebase functions:config:set notifications.enable_trigger="true"
  firebase deploy --only functions
  ```

  Create a notif doc manually and confirm the gated trigger path fires once.

— Joe

**Q1:** Do you want me to remove the now-redundant `sendBadgeUpdateWithRetry` and any dead code references so the file stays tidy?

**Q2:** Should I add a tiny admin-only callable to **resend a test push** to any UID (great for QA and demos)?

**Q3:** Do you want cooldown protection in the chat trigger (e.g., ignore duplicate messages with the same hash within 1s) to prevent double sends from rapid taps?
