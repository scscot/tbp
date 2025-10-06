Absolutely—Android has two solid ways to carry referral data from the Play Store to your app:

## The two paths (mirror your iOS setup)

1. **If the app is already installed → Android App Links (direct deep link)**

   * Use an HTTPS link like `https://links.teambuildpro.com/claim?ref=88888888&t=3`.
   * Configure **Android App Links** (intent-filter + `assetlinks.json`) so the link opens the app directly. You can manage/verify deep links in the **Play Console → Grow → Deep links** dashboard. ([Android Developers][1])

2. **If the app is *not* installed → Install, then deliver data (deferred)**

   * Append a **`referrer=`** parameter to your Play Store URL, e.g.
     `https://play.google.com/store/apps/details?id=com.teambuildpro&referrer=TBP_REF%3A88888888%3BTKN%3Aabc...%3BT%3A3%3BV%3A2` (URL-encode your payload).
   * After first launch, read that referrer string with the **Google Play Install Referrer API** and parse your TBP payload (`TBP_REF:…;TKN:…;T:…;V:2`). ([Android Developers][2])

> In short: **Android App Links** handle the *installed* case; the **Install Referrer API** handles the *install-then-open* case (deferred deep linking).

---

## What to implement for Team Build Pro

### A) Play Store link format (website, ads, QR codes)

* Use your standard TBP payload in the `referrer` param (URL-encoded).
  Example:

  ```
  https://play.google.com/store/apps/details?id=com.teambuildpro
    &referrer=TBP_REF%3A88888888%3BTKN%3A1d08e14a...%3BT%3A3%3BV%3A2
  ```
* You can also stuff **UTM** values into that same `referrer` string if you want GA4 campaign reporting; GA4/Firebase can pick up campaign params via the Install Referrer. ([Google Help][3])

### B) App-side (deferred) — Install Referrer API

* Add the **Play Install Referrer** library and, on first run, connect and fetch:

  * `installReferrer` (your raw referrer payload),
  * `referrerClickTimestampSeconds`,
  * `installBeginTimestampSeconds`.
    Parse and store (`SessionManager`) just like you do on iOS. ([Android Developers][2])

### C) App-side (direct) — Android App Links

* Add `intent-filter` with `android:autoVerify="true"` for your domain (e.g., `links.teambuildpro.com`), publish `/.well-known/assetlinks.json`, and handle the incoming URI the same way you do with iOS Universal Links. You can manage/validate this in Play Console’s **Deep links** dashboard. ([Android Developers][1])

---

## Testing & analytics notes

* **Testing deferred flow**: Use an **Internal testing track** link with `referrer=...`, install from Play, open app, and look for your parsed payload in logs/analytics. (The old broadcast is deprecated—use the Install Referrer API library.) ([Android Developers][2])
* **GA4/Firebase**: If you use Firebase Analytics, it can automatically attribute installs via the Install Referrer; you can also send your own custom event once you parse TBP payload (e.g., `referral_applied`, props: `source=install_referrer`). ([Firebase][4])
* **Dynamic Links**: Google is steering developers toward **App Links + Universal Links** (see Firebase’s migration guide). For your use case, stick with App Links + Install Referrer; you don’t need Firebase Dynamic Links. ([Firebase][5])

---

## Common gotchas (Android)

* **Referrer only comes from Google Play**: The Install Referrer API works when the app is installed via the **Play Store** app (not from sideloads or some third-party stores). ([Android Developers][2])
* **URL-encode** the referrer value; unencoded semicolons/colons can break parsing on the Play side.
* **Single-use timing**: You typically read the referrer once after first launch; cache it immediately (similar to your iOS SessionManager flow).
* **Deep links verification**: Use Play Console’s Deep links dashboard to catch misconfigurations early. ([Android Developers][1])

---

### Quick starter plan for TBP

1. **Generate Play links** with `referrer=TBP_REF:…;TKN:…;T:…;V:2` (URL-encoded).
2. **Implement Install Referrer** read on first launch → parse TBP payload → store → show “Invited by” banner. ([Android Developers][2])
3. **Wire Android App Links** for `https://links.teambuildpro.com/claim?...` to mirror your iOS UL path. ([Android Developers][1])
4. **Track** both paths in GA4: `source=install_referrer` vs `source=applink_direct`. ([Firebase][4])

If you want, I can draft a small Kotlin helper to fetch and parse the Install Referrer and a matching Flutter bridge to drop into your existing referral parser.

[1]: https://developer.android.com/training/app-links?utm_source=chatgpt.com "Handling Android App Links | App architecture"
[2]: https://developer.android.com/google/play/installreferrer?utm_source=chatgpt.com "Google Play Install Referrer | Other Play guides"
[3]: https://support.google.com/analytics/answer/10917952?hl=en&utm_source=chatgpt.com "[GA4] URL builders: Collect campaign data with custom ..."
[4]: https://firebase.google.com/docs/analytics/reports?utm_source=chatgpt.com "Understand your Analytics reports - Firebase - Google"
[5]: https://firebase.google.com/support/guides/app-links-universal-links?utm_source=chatgpt.com "Migrate from Dynamic Links to App Links & Universal Links"


Awesome—here’s a compact, production-ready helper for Android (Kotlin) plus a Flutter bridge. It fetches the Google Play **Install Referrer**, parses your TBP payload (`TBP_REF:…;TKN:…;T:…;V:2`), caches it so it’s only used once, and hands it to your existing parser/SessionManager.

---

# 1) Gradle setup (app/build.gradle)

```gradle
dependencies {
  implementation 'com.android.installreferrer:installreferrer:2.2'
}
```

No special Android permissions are required.

---

# 2) Kotlin helper (fetch + parse + single-use cache)

Create `android/app/src/main/kotlin/com/yourpkg/tbp/TBPInstallReferrer.kt`:

```kotlin
package com.yourpkg.tbp

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.ReferrerDetails
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

data class TBPReferral(
    val ref: String?,    // sponsor code
    val tkn: String?,    // token (may be null)
    val t: String?,      // campaign type (stringified int)
    val v: String?       // payload version
)

object TBPInstallReferrer {
    private const val TAG = "TBP-IR"
    private const val PREFS = "tbp_install_referrer"
    private const val KEY_CONSUMED = "consumed"
    private const val KEY_CACHED = "cached_payload"

    private val regex = Regex("""TBP_REF:([^;]*);TKN:([^;]*);T:([^;]+)(?:;V:([^;]+))?""")

    /**
     * Fetch the Install Referrer once. If already consumed, returns any cached payload (null if none).
     * This call is safe to make at first run; it will be a no-op afterward.
     */
    suspend fun fetchOnce(context: Context): TBPReferral? = withContext(Dispatchers.IO) {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (sp.getBoolean(KEY_CONSUMED, false)) {
            // Already consumed in a prior run — return cached parse if you want (optional)
            parsePayload(sp.getString(KEY_CACHED, null))
        } else {
            val result = connectAndGet(context)
            val parsed = parsePayload(result?.installReferrer)
            // cache + mark consumed regardless (single-use semantics)
            sp.edit()
                .putBoolean(KEY_CONSUMED, true)
                .putString(KEY_CACHED, result?.installReferrer)
                .apply()
            parsed
        }
    }

    private fun parsePayload(payload: String?): TBPReferral? {
        if (payload.isNullOrBlank()) return null
        val m = regex.find(payload) ?: return null
        val ref = m.groupValues.getOrNull(1)?.trim().orEmpty().ifEmpty { null }
        val tkn = m.groupValues.getOrNull(2)?.trim().orEmpty().ifEmpty { null }
        val t   = m.groupValues.getOrNull(3)?.trim().orEmpty().ifEmpty { null }
        val v   = m.groupValues.getOrNull(4)?.trim().orEmpty().ifEmpty { null }
        Log.d(TAG, "parsed: ref=$ref tkn=${tkn?.take(8)}… t=$t v=$v")
        return TBPReferral(ref, tkn, t, v)
    }

    private data class IR(val installReferrer: String?, val clickTs: Long, val installTs: Long)

    private suspend fun connectAndGet(context: Context): IR? = suspendCancellableCoroutine { cont ->
        val client = InstallReferrerClient.newBuilder(context).build()
        client.startConnection(object : InstallReferrerClient.InstallReferrerStateListener {
            override fun onInstallReferrerSetupFinished(responseCode: Int) {
                try {
                    when (responseCode) {
                        InstallReferrerClient.InstallReferrerResponse.OK -> {
                            val details: ReferrerDetails = client.installReferrer
                            val ir = IR(
                                installReferrer = details.installReferrer,
                                clickTs = details.referrerClickTimestampSeconds,
                                installTs = details.installBeginTimestampSeconds
                            )
                            Log.d(TAG, "IR OK: ${ir.installReferrer?.take(60)}")
                            cont.resume(ir)
                        }
                        InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED -> {
                            Log.w(TAG, "IR not supported on this device")
                            cont.resume(null)
                        }
                        InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE -> {
                            Log.w(TAG, "IR service unavailable")
                            cont.resume(null)
                        }
                        else -> {
                            Log.w(TAG, "IR unknown response: $responseCode")
                            cont.resume(null)
                        }
                    }
                } catch (e: Throwable) {
                    Log.e(TAG, "IR error", e)
                    cont.resume(null)
                } finally {
                    try { client.endConnection() } catch (_: Throwable) {}
                }
            }
            override fun onInstallReferrerServiceDisconnected() {
                // Will retry next app start if needed; we return null for now.
                if (cont.isActive) cont.resume(null)
            }
        })

        cont.invokeOnCancellation {
            try { client.endConnection() } catch (_: Throwable) {}
        }
    }
}
```

**Notes**

* It uses a **single-use** semantic via `SharedPreferences` so you don’t re-parse on every launch.
* Regex makes `;V:n` optional, but you should keep writing `;V:2` from the web.
* We truncate token in logs for safety.

---

# 3) Flutter bridge (MethodChannel)

### 3a) Android side: expose a method

Open `android/app/src/main/kotlin/.../MainActivity.kt` (or better, a small plugin file) and add a channel:

```kotlin
package com.yourpkg

import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import com.yourpkg.tbp.TBPInstallReferrer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class MainActivity : FlutterActivity() {
    private val CHANNEL = "tbp/install_referrer"
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getInstallReferrer" -> {
                    scope.launch {
                        val referral = TBPInstallReferrer.fetchOnce(applicationContext)
                        val map = referral?.let {
                            mapOf(
                                "ref" to it.ref,
                                "tkn" to it.tkn,
                                "t"   to it.t,
                                "v"   to it.v
                            )
                        }
                        result.success(map) // null if absent/consumed
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
```

### 3b) Dart side: tiny bridge + model

Create `lib/services/install_referrer_bridge.dart`:

```dart
import 'dart:io' show Platform;
import 'package:flutter/services.dart';

class TBPReferral {
  final String? ref;
  final String? tkn;
  final String? t;
  final String? v;
  const TBPReferral({this.ref, this.tkn, this.t, this.v});
}

class InstallReferrerBridge {
  static const _ch = MethodChannel('tbp/install_referrer');

  /// Returns referral once after Play install; null if none or already consumed.
  static Future<TBPReferral?> fetchOnce() async {
    if (!Platform.isAndroid) return null;
    final map = await _ch.invokeMethod<Map<dynamic, dynamic>?>('getInstallReferrer');
    if (map == null) return null;
    return TBPReferral(
      ref: map['ref'] as String?,
      tkn: map['tkn'] as String?,
      t:   map['t'] as String?,
      v:   map['v'] as String?,
    );
  }
}
```

---

# 4) Integrate with your existing parser / SessionManager

Where you currently run your **first-run init** (e.g., after splash, before showing registration), add:

```dart
import 'package:yourapp/services/install_referrer_bridge.dart';
// import your SessionManager, invite parser, etc.

Future<void> tryApplyAndroidInstallReferrerIfAny() async {
  final ir = await InstallReferrerBridge.fetchOnce();
  if (ir == null || (ir.ref == null || ir.ref!.isEmpty)) return;

  // Store to your existing SessionManager (match your iOS path)
  await SessionManager.instance.setReferralData(
    ir.ref!,
    ir.tkn ?? '',
    queryType: 'install_referrer',
    source: 'install_referrer',
    campaignType: ir.t ?? '1',
  );

  // Optionally surface a toast or update your debug HUD
  // showToast('Invite detected for ${ir.ref}');
}
```

You can call this from the same boot sequence that initializes your deep-link service. If you use a “first route” `FutureBuilder`, run it there so the registration screen sees the stored sponsor immediately.

---

# 5) How to generate Play links (website / QR / ads)

When you build your **Google Play** link, URL-encode the payload into the `referrer` parameter:

```
https://play.google.com/store/apps/details?id=com.yourpkg.app
  &referrer=TBP_REF%3A88888888%3BTKN%3Ad6181f9a...%3BT%3A3%3BV%3A2
```

* Keep the same TBP payload you already standardized on iOS.
* This works for **deferred deep linking**: install → first open → your code reads and applies it.

---

# 6) Testing tips

* Use an **Internal testing** track in Play Console. Share the Play link **with `referrer=...`** to a tester device that installs via the **Play Store app** (not sideload).
* First launch after install should return your payload; subsequent launches will return `null` (we mark it consumed).
* Add a debug UI string or toast when a referral is applied so testers can confirm quickly.
