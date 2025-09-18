Stephen — your dev’s read is fair. If PATCH 2 (gated trigger) and PATCH 5 (chat push) are already in the file and match the spec, great. The two gaps that still matter are the same ones they called out:

* **Dead-token cleanup** isn’t wired.
* **Badge updates** aren’t using the same 3-tier token resolver (so badge sends can silently fail even when pushes work).

Here’s how I’d finish this cleanly and verify it, without churning the rest of the file.

---

# What to ship now (tight and minimal)

## 1) Add dead-token cleanup and call it on the right error

Drop this helper near your other notification helpers (names can match your style):

```js
// cleanupDeadToken(userRef, token)
// Removes the token from: users/{uid}.fcm_token, users/{uid}.fcmTokens[], users/{uid}/fcmTokens/{token}
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

  // Best effort: remove subcollection doc with id === token
  try { await userRef.collection('fcmTokens').doc(token).delete(); } catch (_) {}
}
```

Then, in **both** your push-send code paths (regular notification push and badge push), inside the `catch` where you inspect the error:

```js
const code = err?.code || err?.errorInfo?.code || '';
if (code === 'messaging/registration-token-not-registered') {
  await cleanupDeadToken(userRef, token);
  return { sent: false, reason: 'token_not_registered', tokenSource: source };
}
```

That’s the one behavior that actually keeps the system healthy over time.

---

## 2) Make badge sends use the same 3-tier resolver (and cleanup)

Right now your badge sender reads only `fcm_token`. Replace that token lookup with the **same** function you use for notification pushes (field → array\[0] → newest subcollection docId, all `.trim()`ed). Example shape:

```js
// Resolve best token (same as notification push)
const { token, source } = await resolveBestFcmTokenForUser(userRef, userDataMaybe);
if (!token) {
  console.log('BADGE: no token', { userId });
  return { badgeCount, push: { sent: false, reason: 'no_token', tokenSource: 'none' } };
}

try {
  const resp = await admin.messaging().send({
    token,
    apns: { payload: { aps: { badge: badgeCount } } },
    data: { type: 'badge_update', badgeCount: String(badgeCount) } // force strings
  });
  console.log('BADGE: sent', { userId, badgeCount, response: resp, tokenSource: source });
} catch (err) {
  const code = err?.code || err?.errorInfo?.code || '';
  console.log('BADGE: error', { userId, badgeCount, code, msg: err?.message });
  if (code === 'messaging/registration-token-not-registered') {
    await cleanupDeadToken(userRef, token);
  }
}
```

If you still have a separate `sendBadgeUpdateWithRetry`, you can remove it once this path is in place; it’s redundant.

---

# Nice checks (keep you from future pain)

1. **Delivery mode guard (avoid double sends):**
   If you ever flip the trigger **on** while using the helper, you can double-send. Add a `DELIVERY_MODE` config (`helper|trigger`). In the helper, only send push when `helper`; in the trigger, only send when `trigger`. That keeps behavior unambiguous across environments.

2. **`toStringMap` JSON behavior:**
   When a `data` value is an object/array, JSON-stringify it instead of `String(v)` so you don’t end up with `[object Object]`. If your current helper already JSON-stringifies `route_params`, you’re fine; just keep that consistent anywhere else you pass nested values.

3. **Chat duplicate guard (later):**
   If fast double-taps are common, add a 1-second dedupe by hashing `{chatId,messageId}` (or message text + sender + ts) and skipping if a notif with the same hash exists.

---

# How to validate in 10 minutes

* **Dead-token cleanup:** Set a user’s `fcm_token` to a known bad string, send a test push, confirm logs show `token_not_registered` **and** a subsequent “cleanup” log; verify the token is removed from field/array/subcollection. Open the app, let the token refresh, send again → success.

* **Badge path parity:** With a user who only has a token in `fcmTokens` subcollection (not in the field/array), mark a notification `read=false` → call your badge update → confirm a badge push is sent and logs show `tokenSource: fcmTokens(subcollection)`.

* **Trigger gating sanity:** With `notifications.enable_trigger="false"`, create a notification via the helper and confirm there’s only one push. If you temporarily set it to `"true"`, ensure you’ve set a delivery mode guard first, then test again to avoid duplicates.

---

# My take on the dev’s note

* If PATCH 2 (gated trigger) and PATCH 5 (chat trigger) are present and match the spec, good. The two missing pieces they flagged (dead-token cleanup and badge parity) are exactly the ones that move you from “works today” to **stays healthy** next month.

Ship those two, cut the redundant badge sender, and you’re in strong shape. If you want, I’ll fold in the delivery-mode guard as a tiny follow-up so you can flip the trigger on for experiments without worrying about double sends.