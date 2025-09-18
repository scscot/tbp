Stephen — two things are happening:

1. you hit a real **module-load error** earlier (`FieldValue already declared`) which blocks analysis and deploy entirely;
2. now most **Gen-2** services fail their **Cloud Run healthcheck** (container never finishes starting), which almost always means **an exception at module load** (top-level) or a bad init path shared by many exports. The log spam you pasted is exactly that pattern. &#x20;

Here’s how to get to green, fast.

---

# Fix path (do this in order)

## 0) Confirm module loads locally (catches the real error)

From `functions/`:

```bash
node -e "require('./index.js'); console.log('✅ module loaded')"
```

* If this throws, that’s the same crash Cloud Run is hitting. Fix that first (see steps 1–3).

## 1) Deduplicate Firestore aliases (the crash you already saw)

Keep **exactly one** of these, right after `admin.initializeApp()`:

```js
const db        = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const FieldPath  = admin.firestore.FieldPath;
```

Remove **all other** declarations of `db`, `FieldValue`, and `FieldPath` anywhere in the file. That error will kill every Gen-2 container at cold start.

## 2) Guard any emulator-only `.env` loading

If you’re calling `require('dotenv').config()` at the top of `index.js`, gate it so production doesn’t try to read a local file:

```js
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  require('dotenv').config();
}
```

A missing `.env` won’t always crash, but I’ve seen libs around it do the wrong thing at module load.

## 3) Don’t do work at module scope

Scan the top level of `index.js` for anything **async** or heavy that runs while requiring the file (e.g., `await db.runTransaction(...)`, warm-up queries, `admin.auth().listUsers()`, network calls, etc.). Move that **inside** a function handler. Any throw here prevents the Functions Framework from binding to `PORT=8080`, which is exactly the “healthcheck failed” symptom you’re seeing.

> Quick check:
>
> ```bash
> grep -nE "await |runTransaction\(|listUsers\(|fetch\(" index.js
> ```

## 4) Re-deploy a single failing function to verify the fix

Pick one from the failures (e.g., `getNetworkCounts`) and deploy only that:

```bash
firebase deploy --only functions:getNetworkCounts
```

If it succeeds, roll the rest.

## 5) If any still fail, read the precise container error

Grab the first exception from Cloud Run logs for ONE failing service:

```bash
gcloud run services logs read getnetworkcounts \
  --region us-central1 --project teambuilder-plus-fe74d --limit=200
```

Look for the first stack trace — it will point to a line in `index.js` during `require()`.

---

# Best-practice cleanups (will prevent repeats)

## A) Lock your runtime + SDK

Your deploy output is warning about SDK/runtime drift. Update now to avoid weird edges:

**package.json**

```json
"engines": { "node": "20" }
```

(Already set)&#x20;

Update SDKs:

```bash
cd functions
npm i --save firebase-functions@latest firebase-admin@latest
```

Yes, v5 has a couple of breaking changes, but your current patterns (https.onCall/onRequest/Firestore triggers) are compatible. If you rely on `functions.logger`, great; otherwise `console.*` still works.

## B) Make the new delivery-mode guard bulletproof

If you added my `DELIVERY_MODE` checks, ensure they **don’t** throw at module load. This is safe:

```js
const DELIVERY_MODE = String(
  (functions.config().notifications && functions.config().notifications.delivery_mode) || 'helper'
).toLowerCase();
```

No optional chaining needed; no throw if `notifications` isn’t set.

## C) Avoid double sends

Set your config once:

```bash
firebase functions:config:set notifications.delivery_mode="helper"
firebase functions:config:set notifications.enable_trigger="false"
```

With the guards in place, helper sends and trigger skips (and vice-versa) without causing duplicates.

---

# Quick triage checklist (copy/paste)

1. **Local load test**
   `node -e "require('./index.js'); console.log('OK')"` → must print OK.

2. **Dedup constants**
   Only one `db`, `FieldValue`, `FieldPath`.

3. **No top-level async**
   Searches return nothing suspicious.

4. **Deploy one**
   `firebase deploy --only functions:getNetworkCounts` passes.

5. **Full deploy**
   `firebase deploy --only functions`

If any Cloud Run service still fails healthcheck, pull its first error with the `gcloud run services logs read ...` command above — that line number is the exact fix.