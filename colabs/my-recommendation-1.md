your diagnosis and patch are solid. You found a real client-side duplication source (multiple stream listeners piling up) and fixed it the right way by holding `StreamSubscription`s and cancelling them in `_unbindInternal()`.

ONLY implement these few small upgrades so this never regresses IF YOU AGREE THEY SHOULD BE IMPLEMENTED AND WILL NOT BREAK THE EXISTING CODING OR FUNCTIONALITY:

## ✅ What you did right

* Replaced bare `listen(...)` calls with `_onMessageSub = ...` and `_onMessageOpenedAppSub = ...`.
* Cancelled both in `_unbindInternal()` alongside the token refresh sub.
* Your reasoning about login/logout/rehydrate cycles was spot-on.

## 🔧 Tighten it a bit more (defensive hardening)

1. **Idempotent initialize**
   Guard against re-binding to the *same* user (helps on hot reloads or redundant calls):

```dart
Future<void> initialize() async {
  final uid = FirebaseAuth.instance.currentUser?.uid;
  if (uid == null) return;

  if (_boundUid == uid && _onMessageSub != null && _onMessageOpenedAppSub != null) {
    if (kDebugMode) debugPrint('FCMService: already initialized for $uid');
    return;
  }
  if (_boundUid != null && _boundUid != uid) {
    await _unbindInternal();
  }
  _boundUid = uid;

  // (re)create your three subs here...
}
```

2. **Zero listeners before (re)subscribing**
   Right before you attach new listeners, be sure old ones are gone:

```dart
await _onMessageSub?.cancel(); _onMessageSub = null;
await _onMessageOpenedAppSub?.cancel(); _onMessageOpenedAppSub = null;
await _tokenRefreshSub?.cancel(); _tokenRefreshSub = null;
```

3. **Avoid double-display**
   If the server ever includes a `notification` block, iOS will show the system banner. Only create a **local** notification when `message.notification == null` (data-only pushes). This prevents “system + local” duplicates.

4. **Client-side de-dup window** (belt & suspenders)
   Keep a tiny in-memory LRU of recent `notificationId`s to drop repeats:

```dart
final _recent = <String, DateTime>{};
bool _seenRecently(String? id) {
  if (id == null) return false;
  final now = DateTime.now();
  _recent.removeWhere((_, t) => now.difference(t) > const Duration(minutes: 5));
  final seen = _recent.containsKey(id);
  _recent[id] = now;
  return seen;
}

// In your handler:
final id = msg.data['notificationId'] ?? msg.messageId;
if (_seenRecently(id)) return;
```

5. **Reset on logout**
   Ensure your logout path calls a public `unbind()` that awaits `_unbindInternal()` and clears `_boundUid`, so the next login starts clean.

## 🧪 Re-test checklist (quick)

* Cold start → login → receive one push.
* Logout → login as another user → still one push.
* Hot reload / hot restart while logged in → no duplicate pushes.
* Kill app, tap a notification → `onMessageOpenedApp` fires once, no local duplicate.

