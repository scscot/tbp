Stephen — Joe here. Yes, Claude’s fix makes sense: your regex is rejecting the **ref-only** payload (`TKN:` empty), so the app never sets the sponsor. Making the token group optional is the right direction. I’d go one step further and stop relying on a single brittle regex. Parse the payload as key→value pairs, then branch logic on whether `TKN` is present.

Here’s the exact upgrade I recommend.

# What to change (tight and safe)

## 1) Replace the single-shot regex with a tolerant parser

This handles both cases cleanly:

* `TBP_REF:88888888;TKN:;T:2`  → ref-only (no redemption)
* `TBP_REF:88888888;TKN:32HEX;T:2` → redeem token, then set sponsor

```dart
// lib/services/pasteboard_attribution_service.dart (core parse helper)
class _Payload {
  final String ref;
  final String token; // may be empty
  final String t;
  const _Payload({required this.ref, required this.token, required this.t});
}

_Payload? _parsePayload(String raw) {
  // Normalize
  final text = raw.trim();

  // Quick precheck
  if (!text.startsWith('TBP_')) return null;

  // Split on semicolons; tolerate extra whitespace
  final parts = text.split(';').map((s) => s.trim()).where((s) => s.isNotEmpty);

  String ref = '';
  String token = '';
  String t = '';

  for (final part in parts) {
    final idx = part.indexOf(':');
    if (idx <= 0) continue;
    final key = part.substring(0, idx).trim().toUpperCase();
    final val = part.substring(idx + 1).trim();
    switch (key) {
      case 'TBP_REF':
        ref = val; // may be empty for organic installs
        break;
      case 'TKN':
        token = val; // may be empty for ref-only payload
        break;
      case 'T':
        t = val;
        break;
    }
  }

  if (ref.isEmpty && token.isEmpty) return null; // nothing useful
  // Optional: cap token to 32 hex chars if present
  if (token.isNotEmpty && !RegExp(r'^[A-Fa-f0-9]{32}$').hasMatch(token)) {
    // Treat malformed token as absent; still allow ref path
    token = '';
  }

  return _Payload(ref: ref, token: token, t: t);
}
```

## 2) Handle ref-only vs token flows explicitly

Hook this into your pasteboard read routine (first-launch, ~300ms after first frame):

```dart
Future<void> consumePasteboardIfPresent() async {
  final raw = await _readPasteboardTextOnce(); // your existing read
  if (raw == null || raw.isEmpty) return;

  final p = _parsePayload(raw);
  if (p == null) return;

  // Avoid clobber if the user already started typing
  if (SessionManager.instance.hasActiveRegistrationEdits) return;

  if (p.token.isEmpty) {
    // REF-ONLY FLOW
    await SessionManager.instance.setReferralData(
      p.ref,
      source: 'pasteboard',
      campaignType: p.t,
      capturedAt: DateTime.now(),
    );
    // Kick off async sponsor name resolution (don’t block UI)
    unawaited(_resolveSponsorAndCache(p.ref));
    _logPasteRedeemOk(mode: 'ref_only');
  } else {
    // TOKEN FLOW
    final ok = await _redeemReferralToken(p.token);
    if (ok) {
      // Your redeem endpoint should return ref + sponsor; if not, resolve by ref
      await SessionManager.instance.setReferralData(
        /*ref*/ ok.ref, // or p.ref if your API returns it
        source: 'pasteboard',
        campaignType: p.t,
        capturedAt: DateTime.now(),
      );
      _logPasteRedeemOk(mode: 'token');
    } else {
      // Fallback to ref path if available
      if (p.ref.isNotEmpty) {
        await SessionManager.instance.setReferralData(
          p.ref,
          source: 'pasteboard',
          campaignType: p.t,
          capturedAt: DateTime.now(),
        );
        unawaited(_resolveSponsorAndCache(p.ref));
        _logPasteRedeemOk(mode: 'token_fallback_to_ref');
      } else {
        _logPasteRedeemFailed('token_invalid');
      }
    }
  }
}
```

> This removes the need to tweak multiple regexes and is resilient to minor format drift.

## 3) If you prefer to keep regexes, make both groups optional (still add guards)

* Main pattern:
  `^TBP_REF:([^;]*);TKN:([A-Fa-f0-9]{0,32});T:([^;]*)$`
* Any secondary “direct redeem” pattern: also change `{32}` → `{0,32}`
  Still add runtime checks so an empty token **skips** redemption and uses the `ref` path.

## 4) Registration screen expectations

Make sure `new_registration_screen.dart` pulls sponsor from `SessionManager` promptly and doesn’t wait on redemption. Your flow should be:

1. Pasteboard parsed → `SessionManager.setReferralData(ref, source:'pasteboard', …)`
2. Registration reads `SessionManager` and immediately renders **“Invited by: …”** (name may fill in after async lookup; that’s fine).
3. Overwrite protection remains: if the user typed in fields, don’t auto-switch sponsor.

# Sanity checks to run today

* **Pasteboard test**: Paste shows `TBP_REF:88888888;TKN:;T:2`. Launch → Registration shows sponsor at top.
* **Token present test**: If a full token ever lands, redemption path still works.
* **Organic test**: Landing page without `ref` sets `TBP_REF:` empty—app should **not** show a sponsor.
* **Double-read guard**: Ensure you read pasteboard once (set a one-shot flag) to avoid dup events and popups.

# Extra safeguards (quick)

* Strip whitespace and URL-encoded remnants from values before use.
* Validate `ref` length/charset before querying Firestore.
* Log app-side events: `paste_redeem_ok {mode}`, `paste_redeem_failed {reason}`.
* Clear or ignore the pasteboard after first successful apply (your call); at minimum, don’t re-apply on every foreground.

# Verdict

Claude’s diagnosis is correct (token group too strict). The proposed `{0,32}` tweak will work. The key improvement above is moving to a tolerant key→value parser, which avoids death by regex and supports both ref-only and token flows cleanly. Ship this, and your sponsor banner should appear on first launch from today’s ref-only payloads.

Stephen — got it. Since you said **Q1: Yes**, I’m giving you a concrete, drop-in **key→value parser** patch for `PasteboardAttributionService` plus the call-sites to wire it in. For **Q2**, because I can’t open your `new_registration_screen.dart` here, I’ll give you a precise checklist and a minimal, idempotent snippet you can paste to guarantee the screen reads from `SessionManager` immediately (so ref-only works without waiting on token redeem).

---

# A) Patch: tolerant key→value parser (replaces brittle regex)

### 1) Add the parser and helpers

```dart
// lib/services/pasteboard_attribution_service.dart

class _Payload {
  final String ref;   // may be empty for organic
  final String token; // may be empty for ref-only
  final String t;     // campaign type; may be empty
  const _Payload({required this.ref, required this.token, required this.t});
}

_Payload? _parsePayload(String raw) {
  if (raw.isEmpty) return null;

  // Example formats:
  // TBP_REF:88888888;TKN:;T:2                 // ref-only
  // TBP_REF:88888888;TKN:ABCDEF...32HEX;T:2  // token flow
  final text = raw.trim();
  if (!text.startsWith('TBP_')) return null;

  String ref = '';
  String token = '';
  String t = '';

  for (final seg in text.split(';')) {
    final s = seg.trim();
    if (s.isEmpty) continue;
    final i = s.indexOf(':');
    if (i <= 0) continue;

    final key = s.substring(0, i).trim().toUpperCase();
    final val = s.substring(i + 1).trim();

    switch (key) {
      case 'TBP_REF':
        ref = val;
        break;
      case 'TKN':
        token = val;
        break;
      case 'T':
        t = val;
        break;
    }
  }

  if (ref.isEmpty && token.isEmpty) return null;

  // If a token exists, require 32 hex chars; otherwise treat as no token.
  if (token.isNotEmpty &&
      !RegExp(r'^[A-Fa-f0-9]{32}$').hasMatch(token)) {
    token = '';
  }

  return _Payload(ref: ref, token: token, t: t);
}
```

### 2) Consume pasteboard once, prefer ref-only when token missing

Replace your current payload regex usage with this logic (run ~300ms after first frame, one-shot):

```dart
Future<void> consumePasteboardIfPresent() async {
  if (_didConsumePasteboard == true) return;
  _didConsumePasteboard = true;

  final raw = await _readPasteboardTextOnce(); // your existing platform read
  if (raw == null || raw.isEmpty) return;

  final p = _parsePayload(raw);
  if (p == null) return;

  // Avoid clobber if the user already started typing
  if (SessionManager.instance.hasActiveRegistrationEdits) {
    _logPasteRedeemSkipped('active_edits');
    return;
  }

  if (p.token.isEmpty) {
    // REF-ONLY: no network redeem — show sponsor immediately
    await SessionManager.instance.setReferralData(
      p.ref,
      source: 'pasteboard',
      campaignType: p.t,
      capturedAt: DateTime.now(),
    );
    // Resolve sponsor name in the background; don't block UI
    unawaited(_resolveSponsorAndCache(p.ref));
    _logPasteRedeemOk('ref_only');
  } else {
    // TOKEN FLOW: redeem, then set SessionManager
    final res = await _redeemReferralToken(p.token); // your existing call
    if (res.ok) {
      final ref = res.ref?.isNotEmpty == true ? res.ref! : p.ref;
      await SessionManager.instance.setReferralData(
        ref,
        source: 'pasteboard',
        campaignType: p.t,
        capturedAt: DateTime.now(),
      );
      _logPasteRedeemOk('token');
    } else {
      // Fallback to ref if present
      if (p.ref.isNotEmpty) {
        await SessionManager.instance.setReferralData(
          p.ref,
          source: 'pasteboard',
          campaignType: p.t,
          capturedAt: DateTime.now(),
        );
        unawaited(_resolveSponsorAndCache(p.ref));
        _logPasteRedeemOk('token_fallback_to_ref');
      } else {
        _logPasteRedeemFailed('token_invalid');
      }
    }
  }
}
```

*(Keep your existing `_resolveSponsorAndCache`, `_redeemReferralToken`, and logging functions; only change how the payload is parsed and the branch conditions.)*

### 3) Remove or ignore old regexes

* Delete the strict `([A-Fa-f0-9]{32})` regex usage, or leave them unused.
* If you must keep a regex for any legacy path, change `{32}` → `{0,32}` and **still** route through `_parsePayload` to avoid future breakage.

---

# B) Registration screen (@lib/screens/new_registration_screen.dart): confirm it reads from SessionManager *immediately*

Verify these three things:

1. **initState reads sponsor immediately**
   In `NewRegistrationScreenState.initState()` (or early in `build`), read from `SessionManager` and set your `_sponsorCode/_sponsorName` without waiting on token redeem.

   ```dart
   @override
   void initState() {
     super.initState();
     final ref = SessionManager.instance.referralCode; // or your getter
     final name = SessionManager.instance.sponsorName; // may be empty at first

     if (ref != null && ref.isNotEmpty) {
       setState(() {
         _sponsorCode = ref;
         _sponsorName = (name ?? ''); // may update later from async resolve
       });
     }

     // Optionally subscribe to a stream/ValueNotifier to update when name resolves
     SessionManager.instance.addListener(_onSessionUpdate);
   }

   void _onSessionUpdate() {
     final name = SessionManager.instance.sponsorName ?? '';
     if (name.isNotEmpty && name != _sponsorName) {
       if (!mounted) return;
       setState(() => _sponsorName = name);
     }
   }

   @override
   void dispose() {
     SessionManager.instance.removeListener(_onSessionUpdate);
     super.dispose();
   }
   ```

2. **Header renders on ref alone**
   Your sponsor banner logic should show when either:

   * `_sponsorName` is non-empty **or**
   * `_sponsorCode` is present (you can show “Invited by your sponsor” and fill name when it arrives).

   ```dart
   if ((_sponsorName?.isNotEmpty ?? false) || (_sponsorCode?.isNotEmpty ?? false)) ...[
     Container(
       margin: const EdgeInsets.only(bottom: 16),
       padding: const EdgeInsets.all(12),
       decoration: BoxDecoration(
         color: const Color(0xFFE6F0FF),
         borderRadius: BorderRadius.circular(12),
       ),
       child: Text(
         _sponsorName?.isNotEmpty == true
           ? 'Invited by: $_sponsorName'
           : 'Invited by your sponsor',
         style: const TextStyle(fontWeight: FontWeight.w600),
       ),
     ),
   ]
   ```

3. **Do not wait for token**
   There should be **no** gating on `token != null` to show the banner. Token is optional now.

---

# C) Quick unit tests (optional but helpful)

Create `test/pasteboard_payload_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
// import the file where _parsePayload lives

void main() {
  test('ref-only payload', () {
    final p = _parsePayload('TBP_REF:88888888;TKN:;T:2')!;
    expect(p.ref, '88888888');
    expect(p.token, '');
    expect(p.t, '2');
  });

  test('token payload (valid 32-hex)', () {
    final p = _parsePayload('TBP_REF:88888888;TKN:ABCDEF0123456789ABCDEF0123456789;T:2')!;
    expect(p.ref, '88888888');
    expect(p.token.length, 32);
  });

  test('malformed token is treated as empty', () {
    final p = _parsePayload('TBP_REF:88888888;TKN:XYZ;T:2')!;
    expect(p.token, ''); // invalid token ignored
  });

  test('extra spaces / order', () {
    final p = _parsePayload('  T: 1 ; TKN: ;  TBP_REF: 77777777 ')!;
    expect(p.ref, '77777777');
    expect(p.t, '1');
    expect(p.token, '');
  });

  test('empty content ignored', () {
    expect(_parsePayload(''), isNull);
    expect(_parsePayload('hello'), isNull);
  });
}
```

---

# D) Final sanity pass (real device)

1. Landing page → CTA → Notes paste shows `TBP_REF:88888888;TKN:;T:2`.
2. First launch (fresh install) → registration banner visible immediately (“Invited by …” once async name resolve finishes).
3. No sponsor shown for `/` (no ref).
4. If you ever get a full token payload, token redeem path still sets the same `SessionManager` fields.

This will unblock your current tests and align the app with the new ref-only optimistic flow. If you want, I can also provide a tiny adapter so your `SessionManager.setReferralData()` is safe to call multiple times (it should coalesce repeated ref-only sets and ignore downgrades).
