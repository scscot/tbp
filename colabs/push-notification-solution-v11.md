Stephen — here’s the no-nonsense handoff you can drop to your dev.
— Joe

# Where we started (since your last dev update)

* Deploys were failing due to `functions.config()` calls (not supported in v2), plus some lingering v1 syntax and export confusion.

# What we changed

1. **Killed the real blocker**

   * Removed **all** `functions.config()` usage.
   * Switched to **process.env** with a `.env` file in `functions/`.

2. **Made deploys deterministic**

   * Added an **early .env loader** at the very top of `functions/index.js` so the CLI “analysis” step sees the same env as runtime.
   * Result: no more “missing functions” deletion prompts when the guard should be ON.

3. **v2 hygiene is done**

   * Confirmed v2 imports and trigger syntax (`onDocumentCreated/Updated` etc.).
   * Resolved any prior 1st-gen vs 2nd-gen function name collisions.

4. **Export guard flow**

   * Guard exists to allow single-export debugging when needed.
   * For normal operation we set `DEBUG_ENABLE_EXTRA_EXPORTS=true` so **all** exports are active during deploy.

5. **Delivery model + trigger gating**

   * We’re running in **helper mode**:

     ```
     NOTIFICATIONS_DELIVERY_MODE=helper
     NOTIFICATIONS_ENABLE_TRIGGER=false
     ```
   * `onNotificationCreated` and `onUserProfileCompleted` include **top-of-handler gates** so they **no-op** unless you intentionally flip to trigger delivery later.

6. **Push reliability hardening (already implemented earlier)**

   * Shared 3-tier token resolver (field → array\[0] → subcollection with updatedAt desc).
   * **Dead-token cleanup** wired into push + badge paths.
   * **Badge path parity** (same resolver + transactional increment).
   * Universal `createNotificationWithPush(options)` in production use across sponsorship, subscriptions, trials, deletion summaries, daily growth, and chat messages.

7. **Fleet deployed successfully**

   * You ran `firebase deploy --only functions` with guard **true** at analysis time.
   * CLI reported **successful updates/creates** for the full set, including:

     * `onNotificationCreated`, `onUserProfileCompleted`, `onChatMessageCreated`
     * All onCall/HTTP/scheduled functions (long list in your log).

# Current state (today)

* All functions are **v2** and deployed/updated.
* Helper-mode is **active**. The Firestore triggers are deployed but **gated off** to prevent double-sends.
* Early-env loader ensures analysis/runtime see the same flags.
* Token cleanup + badge parity are live.
* Validators (dead token, badge path, trigger gating) are available.

# What to test next (morning plan)

1. **New user creation → sponsor push (helper path)**

   * Register with a valid referral → complete profile.
   * Expect logs to show `{ ok:true, push:{ sent:true, tokenSource:'...' } }` and a badge increment.
   * Firestore: `users/{sponsorUid}/notifications/sponsorship_<newUserId>` exists and unread.

2. **Chat push**

   * Send A→B; B gets push with sender name + ≤120-char preview and badge bump.

3. **Dead token**

   * Use a sponsor with a bad token (or run the validator); confirm automatic cleanup from field, array, subdoc.

4. **No double-sends**

   * `onUserProfileCompleted` now starts with:

     ```js
     if (process.env.NOTIFICATIONS_DELIVERY_MODE !== 'trigger' ||
         String(process.env.NOTIFICATIONS_ENABLE_TRIGGER || 'false').toLowerCase() !== 'true') {
       console.info('onUserProfileCompleted: trigger disabled; skipping');
       return;
     }
     ```
   * So only the **helper** path sends during these tests.

# When you’re ready to try trigger delivery (later)

* Flip:

  ```
  NOTIFICATIONS_DELIVERY_MODE=trigger
  NOTIFICATIONS_ENABLE_TRIGGER=true
  ```
* Remove or comment out the overlapping **producer helper calls** for those same events to avoid doubles.
* Re-deploy and repeat the acceptance tests.

# Handy checks

* Confirm all functions registered: `firebase functions:list`
* Tail trigger service logs:
  `gcloud run services logs read onnotificationcreated --region us-central1 --project teambuilder-plus-fe74d --limit=200`

Everything is aligned: deploys are stable, helper path is authoritative, cleanup and badge parity are in place, and you’re set to validate pushes for new users and chats.