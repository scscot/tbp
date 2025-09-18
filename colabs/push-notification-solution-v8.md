Stephen — proceed with the export-bisect. You’re at the classic point where the Gen-2 container passes local `require()` but dies on startup because **one export still throws at module load** in the deployed runtime. The fastest way to isolate it is a controlled bisect with a hard guard, plus pulling the *first* Cloud Run error for the failing service.

Here’s an exact, paste-in plan your dev can follow without thinking.

# 1) Add a global export guard (drop-in patch)

Put this near the top of `functions/index.js`, after your imports/aliases/config:

```js
// ==============================
// BEGIN PATCH: export-bisect-guard
// ==============================
const ENABLE_EXTRA_EXPORTS = process.env.ENABLE_EXTRA_EXPORTS === 'true';
// Export a helper to log guard state at cold start
console.log('[EXPORT GUARD]', {
  ENABLE_EXTRA_EXPORTS,
  DELIVERY_MODE,
  NOTIF_TRIGGER_ENABLED,
  node: process.version,
});
// ==============================
// END PATCH: export-bisect-guard
// ==============================
```

# 2) Keep only the one function you’re testing “always on”

Leave your Firestore trigger you want to ship (e.g., `onNotificationCreated`) **outside** any guard so it always exports:

```js
exports.onNotificationCreated = onDocumentCreated(
  'users/{userId}/notifications/{notificationId}',
  async (event) => {
    // …current handler…
  }
);
```

# 3) Wrap *all other* exports under the guard (one block)

Group the rest under `if (ENABLE_EXTRA_EXPORTS) { … }`. Example structure:

```js
// ==============================
// BEGIN PATCH: export-bisect-wrap
// ==============================
if (ENABLE_EXTRA_EXPORTS) {
  exports.onChatMessageCreated = onDocumentCreated('chats/{chatId}/messages/{messageId}', async (event) => {
    // …current handler…
  });

  exports.onUserDocUpdated = onDocumentUpdated('users/{uid}', async (event) => {
    // …current handler…
  });

  // …any other exports go here…
}
// ==============================
// END PATCH: export-bisect-wrap
```

This guarantees the module registers **only one** trigger by default. If the container still fails, the issue is within:

* the imports/aliases/config at the top,
* shared helpers executed at module load (shouldn’t do heavy work),
* or the “always on” function’s file-scope logic.

# 4) Deploy just the single function

```bash
firebase deploy --only functions:onNotificationCreated
```

* If this passes, flip on half the exports:
  `ENABLE_EXTRA_EXPORTS=true firebase deploy --only functions`
  If that fails, split the guarded block into two guarded blocks and toggle one at a time to find the offender.

# 5) Always pull the *first* Cloud Run error for the failing service

(Names are lower-cased service names; region is usually `us-central1`.)

```bash
gcloud run services logs read onnotificationcreated \
  --region us-central1 --project teambuilder-plus-fe74d --limit=200
```

You’re looking for the earliest stack trace on cold start. Common culprits:

* a stray `functions.firestore.document(` or other v1 API (your grep says “no”—good),
* a duplicate `exports.onSomething = …` (grep: `grep -n '^exports\.' index.js`),
* a throw in a helper executed at module scope (ensure all async/work happens **inside** handlers),
* a missing optional dependency required at the top (if any `require()` throws only in prod).

# 6) Lock deployment environment

You already have Node 20 + `firebase-functions@^6.4.0` in `functions/package.json` — keep it that way. Do a clean reinstall to avoid stale artifacts:

```bash
cd functions
rm -rf node_modules package-lock.json
npm install
node -e "require('./index.js'); console.log('✅ module loaded')"
```

# 7) Predeploy guardrail (detect regressions)

Add this script to `functions/package.json` so any accidental v1 usage fails fast:

```json
"scripts": {
  "predeploy:check": "node -e \"const fs=require('fs');const s=fs.readFileSync('index.js','utf8');const bad=/(functions\\.firestore\\.|\\.document\\(|functions\\.pubsub\\.|functions\\.auth\\.user\\(|functions\\.storage\\.object\\(|functions\\.database\\.ref\\()/;if(bad.test(s)){console.error('❌ v1 trigger usage detected');process.exit(2)}else{console.log('✅ no v1 triggers detected')}\"",
  "deploy": "npm run predeploy:check && firebase deploy --only functions"
}
```

Run via:

```bash
npm run deploy
```

# Should you proceed with the bisect?

Yes. You’ve eliminated the naming collisions and updated to v2. The only thing left that explains “container healthcheck failed” is **one export or shared top-level path that throws in the deployed environment**. The guard+bisection isolates it quickly without guesswork.

# Extra recommendations while you’re here

* Keep `notifications.delivery_mode="helper"` and `notifications.enable_trigger="false"` until you’ve fully migrated. No doubles.
* Once green, re-enable other exports incrementally with `ENABLE_EXTRA_EXPORTS=true` to confirm each one is safe, then remove the guard scaffolding.

If the first Cloud Run stack trace points to a specific line you want me to evaluate, paste it and I’ll tell you exactly what to change.