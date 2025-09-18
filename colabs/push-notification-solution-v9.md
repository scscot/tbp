Stephen — you’re on the right track, but a couple tweaks will save time and confusion.

## What your dev did right

* Added the **export-bisect guard** near the top and wrapped “everything else.” Good.
* Kept `onNotificationCreated` outside the guard so you can test deploy. Correct.

## What to change now

1. **Guard *all* exports except the one you’re testing.**
   Those “module imports” you left outside (e.g., `exports.submitContactForm = submitContactForm;`) are still **exports** and will be registered by the Functions Framework. Put them under the guard too, or you’re not truly bisecting.

2. **Use config-backed toggle, not `process.env`.**
   `process.env.ENABLE_EXTRA_EXPORTS` won’t be set in Cloud Run unless you wire env vars per-function. It’s simpler and reliable to reuse your `functions.config()`:

   ```js
   // replace your current guard line with:
   const ENABLE_EXTRA_EXPORTS = String(functions.config().debug?.enable_extra_exports || 'false')
     .trim().toLowerCase() === 'true';
   ```

   Then:

   ```bash
   firebase functions:config:set debug.enable_extra_exports="false"
   firebase deploy --only functions:onNotificationCreated
   # to enable the rest later:
   firebase functions:config:set debug.enable_extra_exports="true"
   firebase deploy --only functions
   ```

3. **Remember: `onNotificationCreated` won’t send pushes in helper mode.**
   With `delivery_mode="helper"` and `enable_trigger="false"`, that trigger is **suppressed by design**. It’s fine for *deploy testing*, but not for push testing. When you’re ready to test pushes, temporarily move **one producer** (e.g., `notifySponsorOfBizOppVisit`) outside the guard and test that path—because it calls `createNotificationWithPush(...)` directly and doesn’t rely on the trigger.

## Minimal, safe sequence to finish this

1. **True single-export deploy**

   * Move **every** `exports.*` except `onNotificationCreated` inside the guard.
   * Switch the guard to the **config** toggle as shown.
   * Deploy:

     ```bash
     firebase deploy --only functions:onNotificationCreated
     ```
   * If healthcheck still fails, pull the *first* startup error:

     ```bash
     gcloud run services logs read onnotificationcreated \
       --region us-central1 --project teambuilder-plus-fe74d --limit=200
     ```

2. **Push-path validation**

   * Leave the guard **off** for everything else.
   * Move `exports.notifySponsorOfBizOppVisit` outside the guard (leave all others wrapped).
   * Deploy those two exports:

     ```bash
     firebase deploy --only functions:onNotificationCreated,functions:notifySponsorOfBizOppVisit
     ```
   * Call the BizOpp callable from your dev client; confirm device receives push, logs show `push.sent=true` and `tokenSource`.

3. **Bring the rest back in controlled chunks**

   * Set `debug.enable_extra_exports="true"` and deploy all.
   * If that reintroduces the healthcheck failure, split the “extras” into **Group A** (HTTP/onCall) and **Group B** (schedulers/other triggers), guard them with two flags, and flip one group at a time to isolate the culprit.

## Quick patch you can paste now

Replace your guard boolean with the config-backed version:

```js
// ==============================
// BEGIN PATCH: export-bisect-guard-toggle
// ==============================
const ENABLE_EXTRA_EXPORTS = String(functions.config().debug?.enable_extra_exports || 'false')
  .trim().toLowerCase() === 'true';
console.log('[EXPORT GUARD]', {
  ENABLE_EXTRA_EXPORTS,
  DELIVERY_MODE,
  NOTIF_TRIGGER_ENABLED,
  node: process.version,
});
// ==============================
// END PATCH: export-bisect-guard-toggle
// ==============================
```

Then ensure **only** this is outside any guard during the first pass:

```js
exports.onNotificationCreated = onDocumentCreated(
  'users/{userId}/notifications/{notificationId}',
  async (event) => { /* ...existing handler... */ }
);
```

Everything else, including those alias exports like `submitContactForm`, goes inside:

```js
if (ENABLE_EXTRA_EXPORTS) {
  exports.submitContactForm = submitContactForm;
  exports.submitContactFormHttp = submitContactFormHttp;
  exports.sendDemoInvitation = sendDemoInvitation;
  // ...all remaining exports...
}
```

## Why this stays focused on push

* We’re not adding complexity; we’re **isolating one startup crash** that blocks deployment.
* Your push path (helper + cleanup + badge parity) is intact and will fire as soon as the module deploys cleanly.

If you paste the toggle patch and wrap the remaining exports, your next single-function deploy should either succeed or point to a single line via the first Cloud Run stack trace. From there, it’s one edit to green.