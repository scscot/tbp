DEPLOYMENT ATTEMPT RESULTS:

sscott@Mac tbp % firebase deploy --only functions

=== Deploying to 'teambuilder-plus-fe74d'...

i  deploying functions
i  functions: preparing codebase default for deployment
i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
i  functions: ensuring required API cloudbuild.googleapis.com is enabled...
i  artifactregistry: ensuring required API artifactregistry.googleapis.com is enabled...
✔  functions: required API cloudfunctions.googleapis.com is enabled
✔  functions: required API cloudbuild.googleapis.com is enabled
✔  artifactregistry: required API artifactregistry.googleapis.com is enabled
⚠  functions: Runtime Node.js 18 was deprecated on 2025-04-30 and will be decommissioned on 2025-10-30, after which you will not be able to deploy without upgrading. Consider upgrading now to avoid disruption. See https://cloud.google.com/functions/docs/runtime-support for full details on the lifecycle policy
⚠  functions: package.json indicates an outdated version of firebase-functions. Please upgrade using npm install --save firebase-functions@latest in your functions directory.
⚠  functions: Please note that there will be breaking changes when you upgrade.
i  functions: Loading and analyzing source code for codebase default to determine what to deploy
i  functions: You are using a version of firebase-functions SDK (4.8.1) that does not have support for the newest Firebase Extensions features. Please update firebase-functions SDK to >=5.1.0 to use them correctly
Serving at port 8692

/Users/sscott/tbp/functions/index.js:60
const { FieldValue, FieldPath } = admin.firestore;
        ^

SyntaxError: Identifier 'FieldValue' has already been declared
    at wrapSafe (node:internal/modules/cjs/loader:1464:18)
    at Module._compile (node:internal/modules/cjs/loader:1495:20)
    at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
    at Module.load (node:internal/modules/cjs/loader:1266:32)
    at Module._load (node:internal/modules/cjs/loader:1091:12)
    at Module.require (node:internal/modules/cjs/loader:1289:19)
    at require (node:internal/modules/helpers:182:18)
    at loadModule (/Users/sscott/tbp/functions/node_modules/firebase-functions/lib/runtime/loader.js:40:16)
    at loadStack (/Users/sscott/tbp/functions/node_modules/firebase-functions/lib/runtime/loader.js:93:23)
    at /Users/sscott/tbp/functions/node_modules/firebase-functions/lib/bin/firebase-functions.js:56:56


Error: Functions codebase could not be analyzed successfully. It may have a syntax or runtime error
sscott@Mac tbp % 

IMPLEMENT JOE’S RECOMMENDED NEXT STEPS:

That deploy error is a straight duplicate declaration. Your patch ended up declaring FieldValue (and likely FieldPath) twice near the top of functions/index.js. Fix is simple and safe.
Fix the crash (2-minute hotfix)
What happened
Node choked on:
const { FieldValue, FieldPath } = admin.firestore;
…because FieldValue was already declared earlier in the file (either via the same destructure or via:
const FieldValue = admin.firestore.FieldValue;
Do this
1. Find all declarations:
cd functions
grep -nE "FieldValue|FieldPath" index.js
1. Keep exactly one canonical block after admin.initializeApp() (and remove the others):
// BEGIN HOTFIX: unify Firestore aliases (keep ONE copy only)
const db = admin.firestore();                 // if already declared elsewhere, keep only one
const FieldValue = admin.firestore.FieldValue;
const FieldPath  = admin.firestore.FieldPath;
// END HOTFIX
1. Delete any other occurrences of:
const { FieldValue, FieldPath } = admin.firestore;
// or
const FieldValue = admin.firestore.FieldValue;
const FieldPath = admin.firestore.FieldPath;
…outside the single hotfix block above.
1. Redeploy:
firebase deploy --only functions
If anything else re-declares db, dedupe that too (keep one const db = admin.firestore();).

Handle the warnings (don’t ignore them)
1) Node 18 deprecation (hard deadline Oct 30, 2025)
Move to Node 20 now to avoid a last-minute scramble.
package.json
"engines": { "node": "20" }
2) firebase-functions upgrade
You’re on 4.8.1. Move to v5.x.
cd functions
npm i --save firebase-functions@latest firebase-admin@latest
# optional: keep peer libs modern
npm i --save @google-cloud/firestore@latest
Notes when jumping to v5:
* Your functions.config() usage is fine.
* Your https.onCall, Firestore triggers, and runWith/region patterns continue to work.
* Prefer functions.logger over console.* for structured logs when you touch those lines next.
Then redeploy:
firebase deploy --only functions

Sanity checks after hotfix + (optional) upgrade
* Unit smoke: node -c functions/index.js (quick syntax check).
* Local grep: confirm only one FieldValue/FieldPath declaration remains.
* Prod test: run your three validation callables; confirm:
    * Dead token test removes field/array/subdoc.
    * Badge parity test logs tokenSource: fcmTokens(subcollection).
    * Trigger gating reflects config state.

Quick hardening (keep you safe later)
* Delivery mode flag (prevents accidental double-sends if someone flips the trigger):const DELIVERY_MODE = String((functions.config().notifications && functions.config().notifications.delivery_mode) || 'helper').toLowerCase();
* 
* // in createNotificationWithPush
* if (DELIVERY_MODE !== 'helper') {
*   return { ok: true, notificationId, push: { sent: false, reason: 'helper_disabled', tokenSource: 'n/a' } };
* }
* 
* // in onNotificationCreated
* if (DELIVERY_MODE !== 'trigger') {
*   console.log('TRIGGER: disabled by delivery_mode');
*   return;
* }
* Set:firebase functions:config:set notifications.delivery_mode="helper"
* 
* Lock down validation callables: admin-only, gated by config:if (!context.auth || !context.auth.token?.admin) {
*   throw new functions.https.HttpsError('permission-denied', 'Admin only');
* }
* if (String(functions.config().debug?.validate_enabled || 'false') !== 'true') {
*   throw new functions.https.HttpsError('failed-precondition', 'Validation disabled');
* }
* 
* Payload size discipline: keep route_params small; it’s already stringified—good.


Stephen — here are drop-in patches with markers so your dev can paste them and move on. This adds a delivery-mode guard (so helper vs trigger can’t double-send) and admin gates around your three validator callables.
— Joe

1) Delivery-mode guard (top of functions/index.js)
Paste this right after your existing config/flag block (NOTIF_TRIGGER_ENABLED), before any helper uses.
// ==============================
// BEGIN PATCH: delivery-mode-guard
// ==============================
// DELIVERY_MODE controls where pushes are sent from:
//   - 'helper'  => createNotificationWithPush sends push + badge (recommended)
//   - 'trigger' => Firestore onCreate trigger sends push + badge
// Any other value disables both (useful for dry runs).
const DELIVERY_MODE = String(
  (functions.config().notifications && functions.config().notifications.delivery_mode) || 'helper'
).toLowerCase();

const isHelperMode  = DELIVERY_MODE === 'helper';
const isTriggerMode = DELIVERY_MODE === 'trigger';
// ==============================
// END PATCH: delivery-mode-guard
// ==============================
Config (set once):
firebase functions:config:set notifications.delivery_mode="helper"

2) Guard the helper (inside createNotificationWithPush)
Find your createNotificationWithPush function. After you resolve notificationId (right before sending the push), add this early-exit:
// ==============================
// BEGIN PATCH: helper-mode-guard
// ==============================
// If we're not in helper mode, stop after doc creation.
// This prevents duplicate sends when someone flips the trigger on.
if (!isHelperMode) {
  return {
    ok: true,
    notificationId,
    push: { sent: false, reason: 'helper_disabled', tokenSource: 'n/a' }
  };
}
// ==============================
// END PATCH: helper-mode-guard
// ==============================
No other changes needed in the helper.

3) Guard the trigger (inside onNotificationCreated)
In your gated trigger, add a delivery-mode check before push logic:
// ==============================
// BEGIN PATCH: trigger-mode-guard
// ==============================
if (!NOTIF_TRIGGER_ENABLED) {
  console.log('TRIGGER: disabled by config; skipping push', { userId, notificationId });
  return;
}
if (!isTriggerMode) {
  console.log('TRIGGER: disabled by delivery_mode; skipping push', { userId, notificationId, DELIVERY_MODE });
  return;
}
// ==============================
// END PATCH: trigger-mode-guard
// ==============================
This ensures you can flip one mode on without risking doubles.

4) Admin gates for validator callables
4A) Add shared guards (place near your other helpers)
// ==============================
// BEGIN PATCH: validator-admin-guards
// ==============================
// Enable/disable validators at runtime
//   debug.validate_enabled: 'true' | 'false'
//   debug.admin_allowlist:  'uid1,uid2,...'
function validatorsEnabled() {
  return String(functions.config().debug?.validate_enabled || 'false').toLowerCase() === 'true';
}

function callerIsAllowedAdmin(context) {
  if (!context?.auth?.uid) return false;
  const isAdminClaim = !!context.auth.token?.admin;
  const allowlist = String(functions.config().debug?.admin_allowlist || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return isAdminClaim || allowlist.includes(context.auth.uid);
}

function assertAdminAndEnabled(context, featureName) {
  if (!validatorsEnabled()) {
    throw new functions.https.HttpsError('failed-precondition', `Validation disabled (${featureName}).`);
  }
  if (!context?.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  if (!callerIsAllowedAdmin(context)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
}
// ==============================
// END PATCH: validator-admin-guards
// ==============================
Config (set once, turn off after rollout):
firebase functions:config:set debug.validate_enabled="true"
# optional allowlist in addition to admin claim
firebase functions:config:set debug.admin_allowlist="YOUR_UID_1,YOUR_UID_2"
4B) Wrap each validator
For each of your three callables (validateDeadTokenCleanup, validateBadgePathParity, validateTriggerGating), wrap the handler body with the guard:
// ==============================
// BEGIN PATCH: validator-guard-wrap (apply to each validator)
// ==============================
exports.validateDeadTokenCleanup = functions.https.onCall(async (data, context) => {
  assertAdminAndEnabled(context, 'validateDeadTokenCleanup');
  // ...existing logic...
});

exports.validateBadgePathParity = functions.https.onCall(async (data, context) => {
  assertAdminAndEnabled(context, 'validateBadgePathParity');
  // ...existing logic...
});

exports.validateTriggerGating = functions.https.onCall(async (data, context) => {
  assertAdminAndEnabled(context, 'validateTriggerGating');
  // ...existing logic...
});
// ==============================
// END PATCH: validator-guard-wrap
// ==============================
(Don’t duplicate exports; just wrap the existing ones.)

5) Quick deploy steps
# Set/confirm runtime config
firebase functions:config:set notifications.delivery_mode="helper"
firebase functions:config:set notifications.enable_trigger="false"
firebase functions:config:set debug.validate_enabled="true"
firebase functions:config:set debug.admin_allowlist="YOUR_UID_1,YOUR_UID_2"

# Deploy
firebase deploy --only functions