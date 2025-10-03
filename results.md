Yes—this plan is solid and will remove the intrusive paste sheet while keeping the referral-paste convenience. I’d ship it with just a few small tweaks and guardrails:

### 👍 What’s great

* **No read on launch** (Phase 2) — fixes the UX/privacy issue.
* **iOS preflight via `hasStrings`** + **user-initiated paste** (Phases 1 & 3) — exactly the right pattern.
* **Skip in Simulator** — avoids the “CoreSimulator-Bridge” dialog during dev.
* Clear file list + version bump — good hygiene.

### Small refinements I recommend

1. **Limit when you offer to paste**

   * Only prompt on screens where a referral can be entered **and** when the field is empty.
   * Gate with a lightweight cooldown (e.g., once per app session or once per 24h via `SharedPreferences`) so users aren’t nagged.

2. **Feature-flag it**

   * Wrap `maybeOfferPasteReferral` behind a Remote Config flag (`referral_clipboard_offer_enabled`). Lets you turn it off remotely if needed.

3. **Validate after paste**

   * After user consents and you read the text, quickly validate with a regex (e.g., matches `teambuildpro://` or your token pattern) before auto-filling.

4. **Android parity**

   * Android doesn’t show the iOS modal, but still follow the same **user-initiated** flow for consistency.

5. **Where to call it**

   * Your plan says `new_registration_screen.dart`. That’s fine; also consider invoking on any first-run “Enter referral” step (or add a small “Paste referral” button next to the field).

### Code notes (to align with your plan)

* **MethodChannel** name: `clipboard_utils` (as you wrote).
* **Only implement `hasStrings`** in Swift; it’s a preflight, not a paste.
* In Dart, call `Clipboard.getData('text/plain')` **only after** the user taps *Paste*.

### Test checklist (post-merge)

* Launch on **Simulator** → **no** system paste sheet.
* Launch on **physical device** with clipboard populated by another app → **no** sheet until user accepts your in-app dialog; after tapping *Paste*, Apple’s sheet may appear (expected, contextual).
* Clipboard empty → no dialog shown.
* Referral already filled → no dialog.
* Remote Config OFF → no dialog anywhere.

### Unrelated log items you can ignore/fix separately

* **Branch SDK**: `Invalid or missing app id/key` — configure Branch keys (test vs live) or guard init to stop the thrown `PlatformException(400)`.
* **FCM in Simulator**: `no APNS Token specified` — expected; verify on device.
* **Functions unauthenticated**: guard `syncAppBadge` until user is signed in.

Here are precise patches to consider for :

* `pubspec.yaml`
* `lib/services/clipboard_helper.dart`
* `ios/Runner/AppDelegate.swift`
* `lib/services/deep_link_service.dart` (remove the auto-check block)
* `lib/screens/new_registration_screen.dart` (post-frame call)

Awesome—here are precise, ready-to-apply patches.

---

### 1) `pubspec.yaml`

```diff
diff --git a/pubspec.yaml b/pubspec.yaml
@@
 dependencies:
   flutter:
     sdk: flutter
+  device_info_plus: ^10.1.2
```

---

### 2) `lib/services/clipboard_helper.dart` (NEW)

```diff
diff --git a/lib/services/clipboard_helper.dart b/lib/services/clipboard_helper.dart
new file mode 100644
--- /dev/null
+++ b/lib/services/clipboard_helper.dart
@@
+import 'dart:io';
+import 'package:flutter/material.dart';
+import 'package:flutter/services.dart';
+import 'package:device_info_plus/device_info_plus.dart';
+
+/// Clipboard helper that prevents iOS paste-permission modal from appearing
+/// at app launch. It only reads the clipboard after explicit user consent.
+class ClipboardHelper {
+  static const MethodChannel _channel = MethodChannel('clipboard_utils');
+
+  /// Returns true when running on a physical iOS device.
+  static Future<bool> isPhysicalIOSDevice() async {
+    if (!Platform.isIOS) return false;
+    final info = await DeviceInfoPlugin().iosInfo;
+    return info.isPhysicalDevice ?? false;
+  }
+
+  /// iOS-only, safe preflight check that **does not** trigger the paste modal.
+  /// Returns true if UIPasteboard has any string content.
+  static Future<bool> iosHasStrings() async {
+    if (!Platform.isIOS) return false;
+    final has = await _channel.invokeMethod<bool>('hasStrings');
+    return has ?? false;
+  }
+
+  /// Offers to paste a referral code (or any text) *after* screen render.
+  /// Only performs an actual paste if the user agrees.
+  static Future<void> maybeOfferPasteReferral(BuildContext context) async {
+    // Skip entirely on non-iOS or Simulator to avoid “CoreSimulator-Bridge” prompts.
+    if (!Platform.isIOS) return;
+    if (!await isPhysicalIOSDevice()) return;
+
+    final has = await iosHasStrings();
+    if (!has || !context.mounted) return;
+
+    final consent = await showDialog<bool>(
+      context: context,
+      builder: (ctx) => AlertDialog(
+        title: const Text('Paste referral from clipboard?'),
+        content: const Text(
+          'We detected text on your clipboard. Would you like to paste it to auto-fill your referral code?',
+        ),
+        actions: [
+          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No thanks')),
+          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Paste')),
+        ],
+      ),
+    );
+    if (consent != true) return;
+
+    // This call may present Apple’s system paste sheet — now with user context.
+    final data = await Clipboard.getData('text/plain');
+    final text = data?.text?.trim();
+    if (text?.isEmpty ?? true) return;
+
+    // TODO: integrate with your referral handling (parse token / URI, then apply).
+    // Example:
+    // context.read<ReferralProvider>().applyReferral(text!);
+  }
+}
```

---

### 3) `ios/Runner/AppDelegate.swift`

```diff
diff --git a/ios/Runner/AppDelegate.swift b/ios/Runner/AppDelegate.swift
--- a/ios/Runner/AppDelegate.swift
+++ b/ios/Runner/AppDelegate.swift
@@
 import UIKit
 import Flutter
@@
 @UIApplicationMain
 class AppDelegate: FlutterAppDelegate {
   override func application(
     _ application: UIApplication,
     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
   ) -> Bool {
-    GeneratedPluginRegistrant.register(with: self)
-    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
+    GeneratedPluginRegistrant.register(with: self)
+
+    // Clipboard preflight channel (safe, non-pasting).
+    if let controller = window?.rootViewController as? FlutterViewController {
+      let channel = FlutterMethodChannel(name: "clipboard_utils",
+                                         binaryMessenger: controller.binaryMessenger)
+      channel.setMethodCallHandler { call, result in
+        switch call.method {
+        case "hasStrings":
+          result(UIPasteboard.general.hasStrings)
+        default:
+          result(FlutterMethodNotImplemented)
+        }
+      }
+    }
+
+    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
   }
 }
```

---

### 4) `lib/services/deep_link_service.dart` (remove auto clipboard read)

```diff
diff --git a/lib/services/deep_link_service.dart b/lib/services/deep_link_service.dart
--- a/lib/services/deep_link_service.dart
+++ b/lib/services/deep_link_service.dart
@@
   Future<void> initialize() async {
     // Existing Branch / cached session init…
@@
-    // ▼▼ REMOVE: intrusive clipboard read at app launch ▼▼
-    try {
-      await PasteboardAttributionService.checkAndRedeemPasteboardToken();
-    } catch (e, st) {
-      log('Pasteboard redeem failed: $e', stackTrace: st);
-    }
-    // ▲▲ REMOVE block ▲▲
+    // Clipboard checks are now user-initiated in UI (see ClipboardHelper).
   }
```

> If your file used a different helper name or lines (e.g., `Clipboard.getData` directly), remove that block similarly. No automatic clipboard reads should occur in `initialize()`.

---

### 5) `lib/screens/new_registration_screen.dart` (post-frame offer)

```diff
diff --git a/lib/screens/new_registration_screen.dart b/lib/screens/new_registration_screen.dart
--- a/lib/screens/new_registration_screen.dart
+++ b/lib/screens/new_registration_screen.dart
@@
 import 'package:flutter/material.dart';
+import 'package:ultimatefix/services/clipboard_helper.dart';
@@
 class NewRegistrationScreenState extends State<NewRegistrationScreen> {
   @override
   void initState() {
     super.initState();
+    // After first frame, politely offer to paste a referral (iOS only, physical device).
+    WidgetsBinding.instance.addPostFrameCallback((_) {
+      if (!mounted) return;
+      ClipboardHelper.maybeOfferPasteReferral(context);
+    });
   }
@@
   @override
   Widget build(BuildContext context) {
     // … existing UI …
   }
 }
```

