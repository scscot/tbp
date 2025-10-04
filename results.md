Here’s a single, copy-paste prompt you can give to Claude. It merges everything we decided plus the exact HTML/JS you need, and clearly explains what to change and why.

---

**Prompt for Claude — Finalize Web-First Invite Flow (Open → App Store fallback) + App Fallback UX**

**From Stephen (product) and Joe (UX/eng). Please read carefully and implement exactly as specified.**

## 0) Context: What you’ve already planned/implemented

Your current “Web-First Invite Link Implementation Plan” is aligned with our direction:

* **Web:** Add **Open Team Build Pro** primary CTA on landing; keep **Continue to App Store**; Universal Link → 1200ms → App Store fallback.
* **App:** Hide paste UI by default; keep subtle **“I have an invite link”** fallback; parse **URLs** (not TBP_REF payloads).
* **Parser:** New `InviteLinkParser` that extracts `ref`/`new` from links and normalizes messy cases.
* **Analytics:** Add paste flow events.
* **Branch:** Verify initialization; ensure deferred deep linking.

## 1) Observations from a real referral link

Using a live example (`https://teambuildpro.com/?new=88888888&t=2`), the landing page already shows **“Invited by …”** and a **Continue to App Store** button. Users typically **tap invite links** (not codes), so the most natural primary action is **Open Team Build Pro** (open app if installed, otherwise fall back to App Store automatically). No “paste” concepts are needed on web.

## 2) Two small but important tweaks to your plan

1. **Universal Link base path**: Our AASA is configured for **root** (`https://teambuildpro.com/?ref=*` and `/?new=*`).
   ➜ Build the Universal Link as `https://teambuildpro.com/` + the original query string. **Do not** use `/app`.
2. **Fallback navigation**: On fallback, use `window.location.replace(APP_STORE_URL)` to avoid back-button bounce.

## 3) Web — Drop-in “Open → Store fallback” snippet (use *exactly* this)

Insert this block into the landing hero/panel where the invite handoff lives (keep the existing “Invited by …” context). This preserves the original query params, attempts the Universal Link to the **root**, and falls back to the App Store if the app isn’t installed.

```html
<!-- Referral handoff panel -->
<section class="invite-handoff">
  <div class="invite-meta">
    <!-- If you can render sponsor name server-side, insert it here -->
    <div class="invited-by">
      Invited by <strong id="sponsorName">Your Sponsor</strong>
    </div>
    <p class="invite-helper">
      We’ll open the app with your invite. If you don’t have it yet, we’ll take you to the App Store.
    </p>
  </div>

  <div class="cta-stack">
    <button id="openApp" class="btn btn-primary">Open Team Build Pro</button>
    <a id="appStore" class="btn-link" href="https://apps.apple.com/app/id6751211622">Continue to App Store</a>
    <noscript>
      <p><a href="https://apps.apple.com/app/id6751211622">Continue to App Store</a></p>
    </noscript>
  </div>
</section>

<script>
  (function () {
    // AASA is configured for root (?ref=* / ?new=*), so keep base at "/"
    const UNIVERSAL_LINK_BASE = 'https://teambuildpro.com/';
    const APP_STORE_URL = 'https://apps.apple.com/app/id6751211622';

    // Preserve original query params (ref/new/t/utm/etc.)
    const params = window.location.search || '';
    const universalLink = UNIVERSAL_LINK_BASE + (params.startsWith('?') ? params : ('?' + params));

    const openBtn = document.getElementById('openApp');

    openBtn.addEventListener('click', function () {
      // disable to avoid double taps
      openBtn.disabled = true;

      // Attempt to open the app via Universal Link
      const start = Date.now();
      window.location.href = universalLink;

      // Fallback to App Store if the app isn't installed
      setTimeout(function () {
        const elapsed = Date.now() - start;
        if (elapsed < 1600) {
          window.location.replace(APP_STORE_URL);
        }
      }, 1200);
    });

    // OPTIONAL: populate sponsor name client-side if available
    // const s = new URLSearchParams(window.location.search).get('sponsor') || '';
    // if (s) document.getElementById('sponsorName').textContent = s;
  })();
</script>

<style>
  .invite-handoff { text-align: center; padding: 16px 12px; }
  .invited-by { font-size: 16px; margin-bottom: 6px; }
  .invite-helper { font-size: 14px; opacity: 0.85; margin: 0 0 16px; }
  .cta-stack .btn { display: inline-block; padding: 12px 18px; border-radius: 12px; border: 0; }
  .btn-primary { background: #111; color: #fff; }
  .btn-primary[disabled] { opacity: .6; }
  .btn-link { display: block; margin-top: 10px; text-decoration: underline; }
</style>
```

### Important: do not let global click handlers hijack the new “Open” button

If you have a capture-phase document click listener that reroutes CTAs to a “copy-and-go” handler (token → App Store), add a guard so it **ignores** `#openApp` and lets its own logic run:

```js
document.addEventListener('click', (e) => {
  // Let the dedicated Open button run its own Universal Link logic
  if (e.target.closest('#openApp')) return;

  // ... your existing CTA interception for app store badges, etc.
  // copyAndGo();
}, { capture: true });
```

> Branch Web SDK (optional): When you add Branch on web, you can replace the `openBtn` handler with `branch.deepview()` or `branch.openURL(universalLink)`; Branch will decide app vs. store and improve deferred deep linking analytics. The structure stays the same.

## 4) App — Keep paste flow as a hidden fallback only

* **Default** registration screen: **no** paste UI visible.
* Add small text: **“I have an invite link”** to reveal paste UI for rare cases when a user copied a link.
* When shown, the button label must be **“Paste invite link”** (not “code”).
* On tap: `ClipboardHelper.pastePlainText()` → `InviteLinkParser` (parse URL, extract `ref`/`new`) → store/apply → show sponsor banner.
* Copy on failure (inline, unobtrusive):
  *“That doesn’t look like an invite link. Please paste the full link you received.”*
* Continue honoring RC flag `referral_clipboard_offer_enabled`. With this direction, keep it **off** by default unless testing.

## 5) Parser utility (new file)

Create `lib/services/invite_link_parser.dart` (as you outlined):

* Accept `teambuildpro://?...` and `https://teambuildpro.com/...` (add first-party host variants if needed).
* Extract the **first non-empty** of `ref` then `new`.
* Normalize: trim whitespace, strip trailing `)]}.,`, percent-decode, add `https://` if missing scheme but host matches.
* Return a result with `success | reason` for analytics (e.g., `no_query_param`, `unrecognized_host`, `malformed_uri`).

## 6) ClipboardHelper updates

* Replace `_parsePayload()` with the new `InviteLinkParser`.
* Update `pasteAndValidateReferral()` to treat input as a **link**, not a TBP_REF payload.
* Set source `invite_link_paste_inline` and log:

  * `invite_link_paste_clicked`
  * `invite_link_parse_success` (token length only)
  * `invite_link_parse_failure` (reason class)

## 7) Analytics

Add methods in `lib/services/analytics_service.dart`:

* `logInviteLinkPasteClicked()`
* `logInviteLinkParseSuccess({required int tokenLength})`
* `logInviteLinkParseFailure({required String reason})`

## 8) Branch initialization

Verify `FlutterBranchSdk.init()` is configured correctly and logs **no errors**, so:

* Direct deep linking (app installed) and
* **Deferred** deep linking (after App Store install)
  both reliably apply the referral.

## 9) QA & acceptance criteria

**Web (Mobile Safari/Chrome):**

* App installed → **Open Team Build Pro** opens the app with referral.
* App not installed → **Open Team Build Pro** falls back to **App Store** after ~1.2s, then referral is applied after install (deferred).
* **Continue to App Store** always goes straight to App Store.

**App:**

* Default registration shows **no** paste UI.
* Tap **“I have an invite link”** → paste UI appears.
* Paste valid invite link → sponsor banner shows.
* Paste invalid text → unobtrusive inline hint (no modal).
* No paste dialogs at launch; no “we detected…” wording anywhere.

**Copy to use (final):**

* Title/line near CTA: **Invited by {Sponsor Name}**
* Helper: *We’ll open the app with your invite. If you don’t have it yet, we’ll take you to the App Store.*
* Primary (web): **Open Team Build Pro**
* Secondary (web): **Continue to App Store**
* App fallback CTA (only if exposed): **Paste invite link**
* App fallback error: *“That doesn’t look like an invite link. Please paste the full link you received.”*

**Please implement the above exactly, using the provided web snippet, the two tweaks (UL root + replace() fallback), and the app-side changes. Share diffs and a short test video covering installed vs. not-installed cases.**
