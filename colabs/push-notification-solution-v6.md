Stephen — you’ve got two separate issues tangled up:

1. your dev started drifting back toward **v1-style functions** (e.g., `functions.firestore.document(...)`) while also importing **v2 APIs**, which breaks after upgrading to `firebase-functions@6`;
2. they proposed **Node 18**, which is already deprecated. Stick with **Node 20**.

Here’s the clean, exact way to fix this and deploy. No creativity — just make it match v5 exactly and ship.

# The one decision: commit to v2 everywhere

You already upgraded the SDK. Do **not** mix v1 and v2. Keep v2, and remove every v1-style call.

## Keep these imports (top of `functions/index.js`)

```js
// v2 HTTPS
const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');
// v2 Firestore triggers
const { onDocumentCreated, onDocumentWritten, onDocumentUpdated, onDocumentDeleted } =
  require('firebase-functions/v2/firestore');
// (optional) v2 logger
const logger = require('firebase-functions/logger');
// Keep classic only for config() (safe); do NOT use functions.firestore.* anywhere.
const functions = require('firebase-functions');

// Firebase Admin
const admin = require('firebase-admin');
admin.initializeApp();

// Canonical Firestore aliases (ONE copy only)
const db         = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const FieldPath  = admin.firestore.FieldPath;
```

# Kill every v1-style trigger

Search for anything like these and fix them:

* `functions.firestore.document('...').onCreate(...)`
* `functions.firestore.document('...').onUpdate(...)`
* `functions.firestore.document('...').onWrite(...)`
* `functions.database.ref('...').onWrite(...)` (if you use RTDB)

## Replace with v2 patterns (mapping)

| v1 (remove)                                                                                    | v2 (use)                                                                                                              |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `exports.X = functions.firestore.document('path').onCreate((snap, context) => {...})`          | `exports.X = onDocumentCreated('path', (event) => { const snap = event.data; const { params } = event; /* ... */ });` |
| `onUpdate((change, context) => { const before = change.before; const after = change.after; })` | `onDocumentUpdated('path', (event) => { const before = event.data?.before; const after = event.data?.after; });`      |
| `onWrite((change, context) => {...})`                                                          | `onDocumentWritten('path', (event) => { const before = event.data?.before; const after = event.data?.after; });`      |

### Concrete example: your gated notification trigger

**Delete** any v1 `.document('users/{userId}/notifications/{notificationId}')...` block and use:

```js
exports.onNotificationCreated = onDocumentCreated('users/{userId}/notifications/{notificationId}', async (event) => {
  const { userId, notificationId } = event.params;
  if (!NOTIF_TRIGGER_ENABLED || !isTriggerMode) {
    console.log('TRIGGER: disabled', { userId, notificationId });
    return;
  }

  const snap = event.data; // QueryDocumentSnapshot for created doc
  const d = snap.data() || {};
  const payload = {
    type: d.type || 'generic',
    title: d.title || 'Team Build Pro',
    message: d.message || d.body || '',
    route: d.route || '/',
    route_params: (() => { try { return JSON.parse(d.route_params || '{}'); } catch { return {}; } })(),
    imageUrl: d.imageUrl || ''
  };

  // Reuse your push path (sendPushToUser + updateUserBadge) OR call your helper conditionally
  const push = await sendPushToUser(userId, notificationId, payload);
  try { await updateUserBadge(userId); } catch (e) { console.log('BADGE non-fatal', e.message); }

  console.log('TRIGGER: done', { userId, notificationId, push });
});
```

### Your chat trigger (same idea)

```js
exports.onChatMessageCreated = onDocumentCreated('chats/{chatId}/messages/{messageId}', async (event) => {
  const { chatId, messageId } = event.params;
  const msg = event.data?.data() || {};

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

  await Promise.all(toUids.map((uid) => {
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
  }));
});
```

# Keep config reads, but never call v1 trigger APIs

You can safely keep:

```js
const rawCfg = (functions.config().notifications || {});
const DELIVERY_MODE = String(rawCfg.delivery_mode || 'helper').trim().toLowerCase();
const NOTIF_TRIGGER_ENABLED = String(rawCfg.enable_trigger || 'false').trim().toLowerCase() === 'true';
```

Just don’t use `functions.firestore` anywhere.

# Package + runtime settings (do this exactly)

**functions/package.json**

```json
{
  "engines": { "node": "20" },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0"
  }
}
```

Node 18 is deprecated and about to be shut off. Don’t go backwards.

# Mechanical cleanup checklist (copy/paste)

From `functions/`:

1. Kill any v1 trigger usages:

```bash
grep -nE "functions\.firestore|\.document\(" index.js
# Resolve every hit by converting to onDocumentCreated/Updated/Written
```

2. Ensure only one Firestore alias block:

```bash
grep -nE "const .*db = admin\.firestore|FieldValue|FieldPath" index.js
# Keep exactly one block after initializeApp()
```

3. Local module-load test (catches the real error fast):

```bash
node -e "require('./index.js'); console.log('✅ module loaded')"
```

4. Deploy a single function to confirm:

```bash
firebase deploy --only functions:onNotificationCreated
```

5. Deploy all:

```bash
firebase deploy --only functions
```

# Why your dev saw “TypeError: functions.firestore.document is not a function”

Because after upgrading to `firebase-functions@6`, you were importing v2 modules but still using a v1 factory (`functions.firestore.document`). In v2, you must use the modular `onDocumentCreated/Updated/Written/Deleted` exports. Mixing the two breaks at module load, which triggers the Cloud Run healthcheck failures.

# What not to touch

* Don’t revert Node to 18.
* Don’t reintroduce duplicate `FieldValue`/`FieldPath`/`db` declarations.
* Don’t remove the **delivery-mode** or **trigger gating** guards — they prevent double sends.

# Final smoke tests

* `validateDeadTokenCleanup` → removes field/array/subdoc.
* `validateBadgePathParity` → logs `tokenSource: fcmTokens(subcollection)`.
* `validateTriggerGating` → with `delivery_mode=helper` and `enable_trigger=false`, helper sends, trigger logs “disabled”.

If you want, I’ll mark up your current `index.js` with exact `// BEGIN PATCH` / `// END PATCH` replacements for the specific lines your dev flagged (the three `.document(...)` usages and any lingering v1 imports).

Yes, please mark up the current `index.js` with exact `// BEGIN PATCH` / `// END PATCH` replacements for the specific lines your dev flagged (the three `.document(...)` usages and any lingering v1 imports).

Stephen — here are precise, paste-in patches with markers to fix the lingering **v1 imports** and the three **`.document(...)`** triggers your dev flagged. These use **v2** APIs only and keep config reads intact. Hand this to your dev and have them replace exactly as shown.

— Joe

---

# PATCH 1 — Replace lingering v1 imports with v2 imports (keep config-safe classic import)

**FIND (remove this whole block if present):**

```js
// BEGIN OLD IMPORTS (v1 style) — REMOVE
const functions = require('firebase-functions');              // <-- v1 used for triggers
// const functions = require('firebase-functions/v1');        // (any variant)
// exports.X = functions.firestore.document(...               // (any usage later will break)
const admin = require('firebase-admin');
admin.initializeApp();
// const { FieldValue, FieldPath } = admin.firestore;         // (duplicate aliases appear later)
// END OLD IMPORTS
```

**REPLACE WITH (keep exactly one copy, at the very top of index.js):**

```js
// ==============================
// BEGIN PATCH: imports-v2-and-aliases
// ==============================

// v2 HTTPS APIs
const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');

// v2 Firestore trigger APIs
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
  onDocumentDeleted,
} = require('firebase-functions/v2/firestore');

// (Optional) v2 logger
const logger = require('firebase-functions/logger');

// Keep classic import ONLY for runtime config (do not use functions.firestore.* anywhere)
const functions = require('firebase-functions');

// Admin SDK
const admin = require('firebase-admin');
admin.initializeApp();

// Canonical Firestore aliases — keep ONE copy only in the file
const db         = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const FieldPath  = admin.firestore.FieldPath;

// Config-derived flags
const rawCfg = functions.config().notifications || {};
const NOTIF_TRIGGER_ENABLED = String((rawCfg.enable_trigger ?? 'false')).trim().toLowerCase() === 'true';
const DELIVERY_MODE = String((rawCfg.delivery_mode ?? 'helper')).trim().toLowerCase();
const isHelperMode  = DELIVERY_MODE === 'helper';
const isTriggerMode = DELIVERY_MODE === 'trigger';

// ==============================
// END PATCH: imports-v2-and-aliases
// ==============================
```

> After applying this, **search** the file for `functions.firestore.` and remove/convert any remaining uses (the patches below handle the three you called out).

---

# PATCH 2 — Convert `.document('users/{uid}') ...` (line \~3807) to v2

Your dev saw:
`index.js:3807  .document('users/{uid}')`

This is almost always an **update** or **write** trigger on the user document. If your original was `onUpdate`, use `onDocumentUpdated`. If it was `onWrite`, use `onDocumentWritten`. Below are both; pick the one that matches your previous handler signature.

### Option A — It was `onUpdate` (most common)

**FIND (remove entire v1 block):**

```js
// BEGIN OLD: user doc v1 trigger — REMOVE
exports.onUserDocUpdated = functions.firestore
  .document('users/{uid}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after  = change.after.data()  || {};
    const { uid } = context.params;

    // ... your existing logic ...
  });
// END OLD
```

**REPLACE WITH (v2):**

```js
// ==============================
// BEGIN PATCH: user-doc-updated-v2
// ==============================
exports.onUserDocUpdated = onDocumentUpdated('users/{uid}', async (event) => {
  const { uid } = event.params;
  const before = event.data?.before?.data() || {};
  const after  = event.data?.after?.data()  || {};

  // ... your existing logic, unchanged ...
});
// ==============================
// END PATCH: user-doc-updated-v2
// ==============================
```

### Option B — It was `onWrite` (less common)

**FIND (remove entire v1 block):**

```js
// BEGIN OLD: user doc v1 trigger — REMOVE
exports.onUserDocWritten = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? (change.before.data() || {}) : null;
    const after  = change.after.exists  ? (change.after.data()  || {}) : null;
    const { uid } = context.params;

    // ... your existing logic ...
  });
// END OLD
```

**REPLACE WITH (v2):**

```js
// ==============================
// BEGIN PATCH: user-doc-written-v2
// ==============================
exports.onUserDocWritten = onDocumentWritten('users/{uid}', async (event) => {
  const { uid } = event.params;
  const before = event.data?.before?.exists ? (event.data.before.data() || {}) : null;
  const after  = event.data?.after?.exists  ? (event.data.after.data()  || {}) : null;

  // ... your existing logic, unchanged ...
});
// ==============================
// END PATCH: user-doc-written-v2
// ==============================
```

---

# PATCH 3 — Convert `.document('users/{userId}/notifications/{notificationId}')` (line \~4379) to v2

This should be **create** only.

**FIND (remove entire v1 block):**

```js
// BEGIN OLD: onNotificationCreated v1 — REMOVE
exports.onNotificationCreated = functions.firestore
  .document('users/{userId}/notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const { userId, notificationId } = context.params;
    const d = snap.data() || {};

    // ... your existing push/badge logic ...
  });
// END OLD
```

**REPLACE WITH (v2 + delivery/trigger guards):**

```js
// ==============================
// BEGIN PATCH: notification-created-v2
// ==============================
exports.onNotificationCreated = onDocumentCreated('users/{userId}/notifications/{notificationId}', async (event) => {
  const { userId, notificationId } = event.params;

  // Config + delivery-mode guards (prevents duplicates)
  if (!NOTIF_TRIGGER_ENABLED) {
    console.log('TRIGGER: disabled by config; skipping push', { userId, notificationId });
    return;
  }
  if (!isTriggerMode) {
    console.log('TRIGGER: disabled by delivery_mode; skipping push', { userId, notificationId, DELIVERY_MODE });
    return;
  }

  const d = event.data?.data() || {};
  const payload = {
    type: d.type || 'generic',
    title: d.title || 'Team Build Pro',
    message: d.message || d.body || '',
    route: d.route || '/',
    route_params: (() => { try { return JSON.parse(d.route_params || '{}'); } catch { return {}; } })(),
    imageUrl: d.imageUrl || ''
  };

  // Reuse your push path
  const push = await sendPushToUser(userId, notificationId, payload);

  // Badge is non-fatal; wrap separately
  try {
    await updateUserBadge(userId);
  } catch (err) {
    console.log('BADGE: non-fatal error', { userId, notificationId, msg: err?.message });
  }

  console.log('TRIGGER: done', { userId, notificationId, push });
});
// ==============================
// END PATCH: notification-created-v2
// ==============================
```

---

# PATCH 4 — Convert `.document('chats/{chatId}/messages/{messageId}')` (line \~4451) to v2

**FIND (remove entire v1 block):**

```js
// BEGIN OLD: onChatMessageCreated v1 — REMOVE
exports.onChatMessageCreated = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { chatId, messageId } = context.params;
    const msg = snap.data() || {};
    // ... rest of your logic ...
  });
// END OLD
```

**REPLACE WITH (v2):**

```js
// ==============================
// BEGIN PATCH: chat-message-created-v2
// ==============================
exports.onChatMessageCreated = onDocumentCreated('chats/{chatId}/messages/{messageId}', async (event) => {
  const { chatId, messageId } = event.params;
  const msg = event.data?.data() || {};

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

  await Promise.all(toUids.map((uid) => {
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
  }));
});
// ==============================
// END PATCH: chat-message-created-v2
// ==============================
```

---

# After patches: sanity steps

1. **Search for any remaining v1 usage**

   ```bash
   grep -nE "functions\.firestore|\.document\(" functions/index.js
   ```

   Expect **no** hits.

2. **One aliases block only**

   ```bash
   grep -nE "admin\.firestore\(\)|FieldValue|FieldPath" functions/index.js
   ```

   Keep **one** set (right after `initializeApp()`).

3. **Local module load**

   ```bash
   node -e "require('./functions/index.js'); console.log('✅ module loaded')"
   ```

4. **Deploy one, then all**

   ```bash
   firebase deploy --only functions:onNotificationCreated
   firebase deploy --only functions
   ```

5. **Config sanity (avoid double sends)**

   ```bash
   firebase functions:config:set notifications.delivery_mode="helper"
   firebase functions:config:set notifications.enable_trigger="false"
   ```
