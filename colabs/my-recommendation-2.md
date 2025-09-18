your fixes are on the right track and should stop the double-display. I’d keep them, with a couple of tiny tweaks so iOS/Flutter don’t sneak a second banner in and so your client/server payloads line up perfectly.

Here’s my take, point-by-point:

# What you did right

* Added `_onMessageSub` and `_onMessageOpenedAppSub` and cancel them in `_unbindInternal()` ✅
  That’s the classic cause of duplicates—multiple live listeners. You fixed it.
* Made `initialize()` idempotent and zeroed all subs before re-subscribing ✅
  Good defensive coding; prevents “zombie” listeners after hot-reloads or user switches.
* Client-side de-dup window with `_recentNotifications` and `_seenRecently()` ✅
  Great safety net. Using `notification_id ?? messageId` is the right key.
* Only show a local/inline notice for **data-only** messages (when `message.notification == null`) ✅
  That avoids the “system banner + in-app toast” double-display.
* Added public `unbind()` and call it on logout ✅
  This pairs nicely with the cleared token.

# Two small tightening tweaks (highly recommended)

1. **Tell iOS not to show a system banner while you’re foregrounded**

Even with your “data-only” check, iOS can still show a foreground banner if the server ever sends a `notification` block (or APNs alert) by mistake. Set foreground presentation options to suppress the alert while the app is active:

```dart
// Do this once on app start (e.g., in main() or inside FCMService.initialize before listeners)
await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
  alert: false, // <- prevents iOS system banner in foreground
  badge: true,
  sound: true,
);
```

That way, **only** your in-app path will display something when in foreground.

2. **Align server data keys with your client’s expectations**

You changed the client to read titles/bodies from `message.data['title']` and `message.data['body']` for data-only pushes. Make sure the server sends those exact keys (in addition to anything else you carry).

If your server currently uses `{ type, title, message, route, route_params, imageUrl }`, also include `body` and `notification_id` (the Firestore doc id) in the sanitized data payload:

```js
// Wherever you build the FCM data payload before sendPushToUser(...)
const payload = {
  type,
  title,
  body: message,              // <-- add this so the client sees message.data['body']
  message,                    // keep if you still use it elsewhere
  route,
  route_params,
  imageUrl,
  notification_id: notificationId, // <-- match client de-dup key
};
```

(If you already send `notification_id`, great—just add `body`.)

# Nice-to-have (optional but good)

* **Dedup on cold-start path too:** If you handle `getInitialMessage()` anywhere, run it through `_seenRecently()` before navigating so tapping a notification doesn’t fire twice if another path already handled it.
* **Debounce navigation:** In `_onMessageOpenedAppSub` and any initial-message handler, guard against rapid double navigations (e.g., same `notification_id` within a few seconds) using your dedup helper.
* **Reset cache on logout:** Your `unbind()` cleans listeners; also do `_recentNotifications.clear()` inside `_unbindInternal()` to avoid edge-case collisions across users.

Example tiny add:

```dart
Future<void> _unbindInternal() async {
  await _tokenRefreshSub?.cancel();
  _tokenRefreshSub = null;

  await _onMessageSub?.cancel();
  _onMessageSub = null;

  await _onMessageOpenedAppSub?.cancel();
  _onMessageOpenedAppSub = null;

  _recentNotifications.clear(); // <- new

  _boundUid = null;
  if (kDebugMode) debugPrint('--- FCMService: Unbound and listeners cleared');
}
```

# Quick verification checklist

* Foreground: send a test data-only push → exactly one in-app toast/snackbar, no iOS banner.
* Background: send a push with `notification` block → exactly one system banner; when tapped, exactly one navigation (dedup should suppress repeats).
* Logout → login as another user → still only one notification per push.
* Hot reload / app restart during a session → no duplicate handlers (watch your debug prints: “already initialized for <uid>”).

---

Bottom line: I agree with your solution and the implementation you showed. Add the iOS foreground-presentation line and make sure the server includes `body` (and `notification_id`) in the data payload, and you’ll have both ends locked down against double-display.
