Stephen — good progress. You cleared the Gen-1/Gen-2 collisions and the local module now loads. The remaining blocker is the **Gen-2 container healthcheck** failing because some code still bombs at module load in the deployed environment. Locally you require `index.js` fine, but Cloud Run loads **all exports** and any leftover v1 trigger or duplicate export will crash the process before it can bind to port 8080.

Here’s the shortest path to green.

# 0) Quick facts you should hold the line on

* Keep **Node 20** in `functions/package.json`. Do not revert to 18.
* Use **v2** trigger APIs everywhere. Don’t mix v1 (`functions.firestore.document(...)`, `functions.pubsub.schedule(...)`, etc.).
* It only takes **one** bad export anywhere in the file to fail the healthcheck, even if you deploy “just one” function — because the framework loads the whole module.

# 1) Find and kill any remaining v1 triggers (all products, not just Firestore)

From `functions/` run these greps. Any hits must be converted or temporarily commented:

```bash
# Firestore (v1)
grep -nE "functions\.firestore|\.document\(" index.js

# Realtime Database (v1)
grep -nE "functions\.database\.ref|database\("\) index.js

# Auth (v1)
grep -nE "functions\.auth\.user\(" index.js

# Storage (v1)
grep -nE "functions\.storage\.object\(" index.js

# Pub/Sub (v1)
grep -nE "functions\.pubsub\." index.js

# Scheduler (v1)
grep -nE "functions\.pubsub\.schedule\(" index.js
```

If anything shows up, convert to v2 equivalents or comment them for now:

* Firestore → `onDocumentCreated/Updated/Written/Deleted` from `firebase-functions/v2/firestore`
* Auth → `onUserCreated/onUserDeleted` from `firebase-functions/v2/identity`
* Storage → `onObjectFinalized/onObjectDeleted` from `firebase-functions/v2/storage`
* RTDB → `onValueCreated/onValueUpdated/onValueDeleted` from `firebase-functions/v2/database`
* Pub/Sub → `onMessagePublished` from `firebase-functions/v2/pubsub`
* Scheduler (cron) → `onSchedule` from `firebase-functions/v2/scheduler`

Example v2 imports (keep them grouped once at top):

```js
const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onUserCreated, onUserDeleted } = require('firebase-functions/v2/identity');
const { onObjectFinalized, onObjectDeleted } = require('firebase-functions/v2/storage');
const { onValueCreated, onValueUpdated, onValueDeleted } = require('firebase-functions/v2/database');
const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const logger = require('firebase-functions/logger');
const functions = require('firebase-functions'); // keep ONLY for config()
```

# 2) Make sure you don’t still export an HTTPS function named `onNotificationCreated`

You deleted a **v2 HTTPS** function with that name earlier. Confirm there’s only **one** export for that name now — the Firestore trigger:

```bash
grep -n "exports\.onNotificationCreated" index.js
```

If you see two, rename one or delete the stray.

# 3) Bisect the module if needed (fastest isolation)

If greps don’t reveal the culprit, do a quick export bisect to prove the file is clean:

1. Wrap all non-essential exports with a guard so they don’t register at module load:

```js
const ENABLE_EXTRA_EXPORTS = false; // temporary

if (ENABLE_EXTRA_EXPORTS) {
  exports.someOtherTrigger = onDocumentUpdated('...', async (event) => { /* ... */ });
  // ...wrap any other exports here...
}
```

2. Confirm only your test function is exported:

```bash
grep -n "^exports\." index.js
```

3. Deploy the single function:

```bash
firebase deploy --only functions:onNotificationCreated
```

If this passes, flip specific exports back on incrementally (set `ENABLE_EXTRA_EXPORTS` per block) until you find the one crashing.

# 4) Read the **first** Cloud Run error for the failing service

For the function that fails deploy, pull the startup logs. The first stack trace pinpoints the exact line:

```bash
# Service names are usually the export name in lowercase
gcloud run services logs read onnotificationcreated \
  --region us-central1 --project teambuilder-plus-fe74d --limit=200
```

Look for errors like:

* “Identifier ‘X’ has already been declared” (duplicate const)
* “TypeError: functions.firestore.document is not a function” (v1 call)
* “Cannot find module …” (uninstalled dep in `functions/node_modules`)
* “Unexpected token export/import” (ESM/CJS mix)

Fix the line it mentions, then redeploy.

# 5) Lock the functions runtime and deps (avoid drift)

Inside `functions/package.json`:

```json
"engines": { "node": "20" },
"main": "index.js",
"type": "commonjs",
"dependencies": {
  "firebase-admin": "^13.0.0",
  "firebase-functions": "^6.0.0"
}
```

And reinstall clean:

```bash
cd functions
rm -rf node_modules package-lock.json
npm ci
```

# 6) Config sanity + one function deploy

```bash
firebase functions:config:get | jq '.notifications'
# Expect: {"delivery_mode":"helper","enable_trigger":"false"}

firebase deploy --only functions:onNotificationCreated
```

If this succeeds, then:

```bash
firebase deploy --only functions
```

# 7) Guardrails so this doesn’t regress

Add a **predeploy check** (root package.json or functions/package.json script) that fails the deploy if any v1 patterns exist:

```json
"scripts": {
  "predeploy:check": "node -e \"require('fs').readFile('functions/index.js','utf8',(e,s)=>{if(e)process.exit(1);const bad=/(functions\\.firestore\\.|\\.document\\(|functions\\.pubsub\\.|functions\\.auth\\.user\\(|functions\\.storage\\.object\\(|functions\\.database\\.ref\\()/;if(bad.test(s)){console.error('❌ v1 trigger usage detected');process.exit(2)}else{console.log('✅ no v1 triggers detected')}})\"",
  "deploy": "npm run predeploy:check && firebase deploy --only functions"
}
```

Run:

```bash
npm run deploy
```

---
