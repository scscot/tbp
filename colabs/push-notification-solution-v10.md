you’re on the right track. You fixed the actual blocker: removing every `functions.config()` call. That’s why Gen-2 was crashing on startup.

Two clarifications before your dev goes further:

1. You **don’t have to** use `defineString(...)` to read env in v2. Reading from `process.env` is fully supported for Gen-2; the Firebase CLI will inject values from your `.env` files at deploy.
2. The **Params API** (`defineString`, etc.) is optional. It’s nice for validation and typed access, but not required. If you want to use it, I’ll give you exact patches. If not, keep what you have: lean, stable, deployable.

Given your current edits, you’re good to deploy **without** adding Params. If you want the Params version, here are clean, drop-in patches.

---

# Option A (recommended now): keep `process.env` and ship

You already replaced:

* `NOTIF_TRIGGER_ENABLED` → reads `process.env.NOTIFICATIONS_ENABLE_TRIGGER`
* `DELIVERY_MODE` → reads `process.env.NOTIFICATIONS_DELIVERY_MODE`
* `ENABLE_EXTRA_EXPORTS` → reads `process.env.DEBUG_ENABLE_EXTRA_EXPORTS`
* `validatorsEnabled()` and `callerIsAllowedAdmin()` → read `DEBUG_VALIDATE_ENABLED` and `DEBUG_ADMIN_ALLOWLIST`

That’s correct. All you need is a `.env` file and a deploy.

## 1) Create your env file (functions/.env)

```
NOTIFICATIONS_DELIVERY_MODE=helper
NOTIFICATIONS_ENABLE_TRIGGER=false

DEBUG_ENABLE_EXTRA_EXPORTS=false
DEBUG_VALIDATE_ENABLED=true
DEBUG_ADMIN_ALLOWLIST=YOUR_UID_1,YOUR_UID_2
```

If you use multiple Firebase projects, you can add per-project files like `.env.teambuilder-plus-fe74d` with project-specific overrides.

## 2) Quick sanity & deploy

```bash
cd functions
node -e "process.env.NOTIFICATIONS_ENABLE_TRIGGER='false';process.env.NOTIFICATIONS_DELIVERY_MODE='helper';process.env.DEBUG_ENABLE_EXTRA_EXPORTS='false';require('./index.js');console.log('✅ module loaded')"

firebase deploy --only functions:onNotificationCreated
```

If that deploys cleanly, flip the guard back on later:

```bash
# turn the rest on
# (edit functions/.env)
DEBUG_ENABLE_EXTRA_EXPORTS=true

firebase deploy --only functions
```

That’s it. No more `functions.config()`; no need to wire Params if you don’t want them.

---

# Option B (optional): switch to Params API with exact patches

If you prefer Params (type-checked, visible in the console), paste these **exact** patches and remove your current `process.env` reads.

## PATCH: add params and compute flags

Place this where your imports live (top of file), **before** you compute flags:

```js
// ==============================
// BEGIN PATCH: v2-params-definitions
// ==============================
const { defineString, defineBoolean } = require('firebase-functions/params');

const p_NOTIFICATIONS_DELIVERY_MODE   = defineString('NOTIFICATIONS_DELIVERY_MODE', { default: 'helper' });
const p_NOTIFICATIONS_ENABLE_TRIGGER  = defineBoolean('NOTIFICATIONS_ENABLE_TRIGGER', { default: false });

const p_DEBUG_ENABLE_EXTRA_EXPORTS    = defineBoolean('DEBUG_ENABLE_EXTRA_EXPORTS', { default: false });
const p_DEBUG_VALIDATE_ENABLED        = defineBoolean('DEBUG_VALIDATE_ENABLED', { default: false });
const p_DEBUG_ADMIN_ALLOWLIST         = defineString('DEBUG_ADMIN_ALLOWLIST', { default: '' });
// ==============================
// END PATCH: v2-params-definitions
// ==============================
```

Replace your current flag computation block with this:

```js
// ==============================
// BEGIN PATCH: v2-params-flags
// ==============================
const NOTIF_TRIGGER_ENABLED = !!p_NOTIFICATIONS_ENABLE_TRIGGER.value();
const DELIVERY_MODE = String(p_NOTIFICATIONS_DELIVERY_MODE.value() || 'helper').trim().toLowerCase();

const isHelperMode  = DELIVERY_MODE === 'helper';
const isTriggerMode = DELIVERY_MODE === 'trigger';

const ENABLE_EXTRA_EXPORTS = !!p_DEBUG_ENABLE_EXTRA_EXPORTS.value();
const VALIDATE_ENABLED     = !!p_DEBUG_VALIDATE_ENABLED.value();
const ADMIN_ALLOWLIST      = String(p_DEBUG_ADMIN_ALLOWLIST.value() || '');
// ==============================
// END PATCH: v2-params-flags
// ==============================
```

And update the two helper spots you already touched to use the new constants (you’ve basically done this; just ensure they now reference `VALIDATE_ENABLED` / `ADMIN_ALLOWLIST`):

```js
// validatorsEnabled()
return VALIDATE_ENABLED;

// callerIsAllowedAdmin()
const allowlist = ADMIN_ALLOWLIST.split(',').map(s => s.trim()).filter(Boolean);
```

**Note:** When using Params, you still set values via `.env` files or the console; Params simply define shape & defaults.

---

# Guard usage: one correction

Your dev moved the “module re-export” lines (`submitContactForm`, etc.) **under the guard** — good. Make sure **every** `exports.*` except `onNotificationCreated` is under the guard during the bisect, including any tiny pass-through exports. That’s how we guarantee a single export gets registered until we toggle the rest on.

---

# What to do next (tight plan)

1. **Don’t add Params unless you want them.** Your current `process.env` approach is valid and deployable.
2. Ensure `.env` exists under `functions/`.
3. Confirm only `onNotificationCreated` is exported outside the guard.
4. Deploy the single function.
5. If it’s green, toggle `DEBUG_ENABLE_EXTRA_EXPORTS=true` and deploy all.
6. Once everything loads, test real pushes via producers (BizOpp visit callable, daily jobs). In helper mode, they **already** call `createNotificationWithPush(...)`, so pushes will go out without the trigger.

---

# Quick verification checklist

* `grep -n "functions.config()" index.js` → **no matches**.
* `node -e "require('./index.js'); console.log('OK')"` prints `[EXPORT GUARD]` with flags.
* `firebase deploy --only functions:onNotificationCreated` succeeds.
* Cloud Run startup logs show your `[EXPORT GUARD]` line with the expected values.
* When `DEBUG_ENABLE_EXTRA_EXPORTS=true`, full deploy succeeds.
* Calling `notifySponsorOfBizOppVisit` sends a push; logs show `push.sent=true` and `tokenSource`.

You’re back on track and focused on the goal: reliable pushes. Your edits are correct; you don’t need to switch to Params unless you want the niceties. If you’d like, I can generate a minimal `.env` matrix for dev/stage/prod so your dev can just copy files and deploy.
