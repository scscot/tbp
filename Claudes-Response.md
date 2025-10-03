Complete Review & Understanding Verification

  I've carefully read Joe's full recommendations document. Let me verify my understanding before proceeding.

  ---
  ✅ What I Understand

  Architecture Overview

  Priority 1: App Clip → Full App (Primary Path)
  User clicks CTA → App Clip opens → Shows "Invited by [Name]" →
  User taps "Get the App" → iOS installs full app →
  NSUserActivity hands off {ref, t, handoffId} → Registration shows sponsor

  Priority 2: Smart App Banner (Already Installed)
  User clicks CTA with app installed → Smart App Banner opens app →
  Deep link `/claim?ref=...&t=...` → Apply sponsor

  Priority 3: Pasteboard (Silent Fallback)
  CTA silently copies token → App Store → Install →
  App checks pasteboard on first launch (~300ms delay) → Apply sponsor

  Priority 4: Magic Link (Recovery)
  If sponsor unknown on first launch → Prompt for phone/email →
  Send SMS/email with `/claim` link → User taps → Apply sponsor

  ---
  ✅ Key Technical Details I Must Implement

  1. AASA Files (Already Done by Stephen)

  - ✅ Both domains have been updated
  - ✅ Correct structure: applinks for full app, appclips for Clip
  - ✅ Components cover all routes: /, /claim with query params

  2. Backend Functions (New Work)

  Four Cloud Functions to implement:

  | Function          | Purpose                      | Input                    | Output                         |
  |-------------------|------------------------------|--------------------------|--------------------------------|
  | issueReferral     | Create attribution token     | {sponsorCode, t, source} | {token, expiresAt}             |
  | redeemReferral    | Redeem token (idempotent)    | {token}                  | {status, sponsorCode, t}       |
  | clipHandoffCreate | Store Clip handoff data      | {handoffId, ref, t}      | {handoffId, created, sponsor?} |
  | clipHandoffClaim  | Claim handoff from full app  | {handoffId}              | {found, claimed, ref, t}       |
  | resolveSponsor    | Get sponsor name for display | {ref}                    | {ref, sponsor}                 |

  Critical implementation details:
  - ✅ Rate limiting: 30/min per IP
  - ✅ TTL: 24 hours on tokens and handoffs
  - ✅ Idempotency: All endpoints return stable responses on retry
  - ✅ CORS: Allow production domains + localhost
  - ✅ Firestore security: Only Functions can read/write tokens/handoffs

  3. Web Changes

  Capture-phase click handler:
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.js-appstore-btn,[data-appstore],#cta-hero,#cta-pricing,#cta-final,#cta-footer,.app-store-badge');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    copyAndGo(); // Silent clipboard copy → App Store
  }, { capture: true });

  Key behaviors:
  - ✅ Silent clipboard copy (no modal in happy path)
  - ✅ Only show fallback dialog if issueReferral fails OR clipboard throws
  - ✅ Direct to App Store (not App Clip - iOS decides)

  Smart App Banner:
  - ✅ Already implemented (dynamic injection)
  - ✅ Correct understanding: Only works for already-installed users

  4. iOS Full App Changes

  Three entry points for sponsor attribution:

  A. NSUserActivity handler (App Clip handoff):
  func application(_ application: UIApplication,
                   continue userActivity: NSUserActivity,
                   restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
      if userActivity.activityType == "com.teambuildpro.invite" {
          let ref = userActivity.userInfo?["ref"] as? String
          let t = userActivity.userInfo?["t"] as? String
          let handoffId = userActivity.userInfo?["handoffId"] as? String
          InviteBridge.shared.apply(ref: ref, t: t, handoffId: handoffId, source: "useractivity")
          return true
      }
      return false
  }

  B. Universal Link handler (SceneDelegate):
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
      if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
         let url = userActivity.webpageURL,
         url.path == "/claim" {
          // Parse ref|new, token|tkn, t from query params
          // Call InviteBridge.shared.apply(...)
      }
  }

  C. Pasteboard check (first launch only):
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 300), () async {
        final payload = await PasteboardAttributionService.readOnce();
        if (payload != null) {
          await applyClaim(ClaimParams(
            token: payload.token,
            sponsorCode: payload.ref,
            campaignType: payload.t,
            source: 'pasteboard',
          ));
        }
      });
    });
  }

  5. iOS App Clip Target

  New SwiftUI view:
  - Shows "Invited by [Name]" (fetches from resolveSponsor)
  - "Get the App" button that:
    a. Creates NSUserActivity with {ref, t, handoffId}
    b. Calls clipHandoffCreate (fire-and-forget)
    c. Opens App Store URL
  - Must be under 10MB (SwiftUI only, no Flutter)

  6. Flutter Integration

  Method channel bridge:
  static const _channel = MethodChannel('tbp/invite');

  static void startListening(void Function(Map args) onApply) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'invite.apply' && call.arguments is Map) {
        onApply(Map<String, dynamic>.from(call.arguments));
      }
    });
  }

  Claim flow:
  1. If token present → Call redeemReferral → Apply sponsor
  2. Else if sponsorCode present → Apply directly
  3. Write to SessionManager immediately
  4. Registration screen reads from SessionManager

  ---
  ✅ Critical Constraints & Guardrails

  Joe's Corrections Applied:

  1. ✅ AASA structure: Full app in applinks, Clip in separate appclips section (already done)
  2. ✅ No App Group sharing: Use NSUserActivity (primary) + server rendezvous (fallback)
  3. ✅ Smart App Banner limitation: Only for already-installed users (not first install)
  4. ✅ Silent pasteboard: Only show UI on error
  5. ✅ 300ms delay: Pasteboard check timing for iOS permission prompt
  6. ✅ Parameter parity: Accept token|tkn and ref|new
  7. ✅ App Clip 10MB limit: SwiftUI only, no Flutter, minimal assets
  8. ✅ Real device testing required: App Clips don't work in Simulator

  ---
  ✅ Implementation Plan (Verified)

  Phase 1: Backend (I execute fully)

  1. Create functions/src/types.ts with all TypeScript interfaces
  2. Create functions/src/referrals.ts with all 5 functions
  3. Update functions/src/index.ts to export functions
  4. Update Firestore security rules
  5. Test with curl commands
  6. Deploy to production

  Files to create/modify:
  - functions/src/types.ts (new)
  - functions/src/referrals.ts (new)
  - functions/src/index.ts (modify)
  - firestore.rules (modify)

  Phase 2: Web (I execute fully)

  1. Verify AASA files are correct (already done by Stephen)
  2. Update web CTA handler to be silent (modify existing copyAndGo)
  3. Verify Smart App Banner injector (already done)
  4. Remove visible modals from happy path

  Files to modify:
  - web/index.html (update copyAndGo function)

  Phase 3: Flutter (I provide code, you/Joe test)

  1. Create InviteChannel class for method channel
  2. Create ClaimParams parser
  3. Create ReferralService for token redemption
  4. Create applyClaim orchestration
  5. Wire to main() and app boot
  6. Update PasteboardAttributionService for new payload format

  Files to create/modify:
  - lib/services/invite_channel.dart (new)
  - lib/services/referral_service.dart (new or update existing)
  - lib/main.dart (modify)
  - lib/services/pasteboard_attribution_service.dart (modify)

  Phase 4: iOS Native (I provide code, you/Joe test in Xcode)

  1. Create InviteBridge.swift for method channel
  2. Update AppDelegate.swift with NSUserActivity handler
  3. Update SceneDelegate.swift with Universal Link handler
  4. Wire InviteBridge.shared.messenger to Flutter engine

  Files to create/modify:
  - ios/Runner/InviteBridge.swift (new)
  - ios/Runner/AppDelegate.swift (modify)
  - ios/Runner/SceneDelegate.swift (modify or create if needed)

  Phase 5: App Clip (I provide code + guide, you/Joe execute in Xcode)

  1. Create App Clip target in Xcode
  2. Create InviteClipView.swift with SwiftUI UI
  3. Parse invocation URL in Clip's SceneDelegate
  4. Configure entitlements
  5. Configure App Store Connect experiences

  New Xcode target + files:
  - App Clip target configuration
  - Clip/InviteClipView.swift (new)
  - Clip/ClipSceneDelegate.swift (new)
  - Clip.entitlements (new)

  Phase 6: Testing & Deployment

  1. Test with curl (Backend)
  2. Test web silent copy (Web)
  3. Test all 4 attribution paths on real device (iOS)
  4. Submit App Clip to App Store Connect
  5. Configure App Clip experiences

  ---
  ✅ Questions for Clarification

  Before I begin, I need to verify a few project-specific details:

  Q1: Firebase Project Configuration

  What are your Firebase project values?
  - Region: us-central1 (assumed from existing code)
  - Project ID: teambuilder-plus-fe74d (assumed from existing code)
  - Confirm these are correct?

  Q2: Function Names

  Joe's code uses function export names like:
  - issueReferralFn
  - redeemReferralFn
  - clipHandoffCreateFn
  - clipHandoffClaimFn
  - resolveSponsorFn

  But your existing code uses:
  - issueReferral
  - redeemReferral

  Should I:
  - A) Keep existing names and add new functions with Fn suffix?
  - B) Rename existing functions to match Joe's convention?
  - C) Use different naming?

  Q3: Existing Referral Functions

  You already have issueReferral and redeemReferral in functions/referral-attribution-functions.js. Should I:
  - A) Replace them entirely with Joe's TypeScript versions?
  - B) Merge Joe's logic into your existing JavaScript versions?
  - C) Create new TypeScript versions alongside existing ones?

  Q4: Users Collection Structure

  Joe's tryResolveSponsor function looks up users by referral code:
  const doc = await db.collection('users').doc(ref).get();

  But your system uses referralCodes/{code} → Firebase UID mapping. Should I:
  - A) Update to use your existing referralCodes lookup first?
  - B) Use direct users/{ref} lookup (assuming ref = Firebase UID)?

  Q5: SessionManager API

  What's the exact method signature for storing referral data in SessionManager?
  await SessionManager.instance.setReferralData(code, sponsorName: '', source: p.source);
  Is this correct, or different in your implementation?

  ---
  ✅ My Confidence Assessment

  | Component                      | Confidence | Why                                                  |
  |--------------------------------|------------|------------------------------------------------------|
  | Backend Functions (TypeScript) | 100%       | Complete code provided by Joe, just need project IDs |
  | Web Changes                    | 100%       | Straightforward modifications to existing code       |
  | Firestore Rules                | 100%       | Exact rules provided                                 |
  | Flutter Claim Flow             | 95%        | Code provided, need to verify SessionManager API     |
  | iOS Swift Bridge               | 90%        | Code provided, need Xcode testing                    |
  | App Clip SwiftUI               | 85%        | Code provided, need Xcode setup + testing            |
  | App Store Connect Setup        | 70%        | Need step-by-step guide for you to execute           |

  ---
  ✅ Final Verification

  Do I understand the task?
  - ✅ YES - Implement App Clip-first attribution system with 4 fallback layers

  Is this enterprise-grade?
  - ✅ YES - Apple-native, no SDKs, multiple redundant paths, compliant

  Can I implement accurately?
  - ✅ YES for Phases 1-2 (Backend + Web) - I execute alone
  - ✅ YES for Phases 3-5 (Flutter + iOS + Clip) - I provide code, you/Joe test

  What do I need from you before starting?
  - ✅ Answers to Q1-Q5 above
  - ✅ Confirmation to proceed with Phase 1 (Backend + Web)

  ---
  🎯 Ready to Execute

  I am ready to implement Joe's architecture exactly as specified. Once you answer Q1-Q5, I will:

╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Ready to code?                                                                                                                                                                                               │
│                                                                                                                                                                                                              │
│ Here is Claude's plan:                                                                                                                                                                                       │
│ ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮ │
│ │ App Clip Attribution System - Implementation Plan                                                                                                                                                        │ │
│ │                                                                                                                                                                                                          │ │
│ │ Understanding Verified ✅                                                                                                                                                                                 │ │
│ │                                                                                                                                                                                                          │ │
│ │ - App Clip → Full App (NSUserActivity handoff) as primary path                                                                                                                                           │ │
│ │ - Smart App Banner for already-installed users                                                                                                                                                           │ │
│ │ - Silent pasteboard fallback (no modal in happy path)                                                                                                                                                    │ │
│ │ - Magic link recovery if all else fails                                                                                                                                                                  │ │
│ │ - Enterprise-grade: Apple-native, no SDKs, fully compliant                                                                                                                                               │ │
│ │                                                                                                                                                                                                          │ │
│ │ Phase 1: Backend Functions (TypeScript)                                                                                                                                                                  │ │
│ │                                                                                                                                                                                                          │ │
│ │ I will execute fully:                                                                                                                                                                                    │ │
│ │ 1. Create functions/src/types.ts with all TypeScript interfaces from Joe's spec                                                                                                                          │ │
│ │ 2. Create functions/src/referrals.ts with 5 functions:                                                                                                                                                   │ │
│ │   - issueReferral - Token issuance with rate limiting                                                                                                                                                    │ │
│ │   - redeemReferral - Idempotent token redemption                                                                                                                                                         │ │
│ │   - clipHandoffCreate - Store Clip handoff + resolve sponsor name                                                                                                                                        │ │
│ │   - clipHandoffClaim - Full app claims handoff data                                                                                                                                                      │ │
│ │   - resolveSponsor - Get sponsor name for App Clip display                                                                                                                                               │ │
│ │ 3. Update functions/src/index.ts to export all functions                                                                                                                                                 │ │
│ │ 4. Update firestore.rules with tight security (tokens read/write blocked from clients)                                                                                                                   │ │
│ │ 5. Provide curl test commands for verification                                                                                                                                                           │ │
│ │                                                                                                                                                                                                          │ │
│ │ Files created/modified:                                                                                                                                                                                  │ │
│ │ - functions/src/types.ts (new)                                                                                                                                                                           │ │
│ │ - functions/src/referrals.ts (new)                                                                                                                                                                       │ │
│ │ - functions/src/index.ts (modify exports)                                                                                                                                                                │ │
│ │ - firestore.rules (modify)                                                                                                                                                                               │ │
│ │                                                                                                                                                                                                          │ │
│ │ Phase 2: Web Updates                                                                                                                                                                                     │ │
│ │                                                                                                                                                                                                          │ │
│ │ I will execute fully:                                                                                                                                                                                    │ │
│ │ 1. Verify AASA files (already done by Stephen - just confirm)                                                                                                                                            │ │
│ │ 2. Update copyAndGo() to be silent:                                                                                                                                                                      │ │
│ │   - Copy token to clipboard silently                                                                                                                                                                     │ │
│ │   - Redirect to App Store immediately                                                                                                                                                                    │ │
│ │   - Only show fallback dialog if issueReferral fails OR clipboard throws                                                                                                                                 │ │
│ │ 3. Smart App Banner already implemented correctly                                                                                                                                                        │ │
│ │                                                                                                                                                                                                          │ │
│ │ Files modified:                                                                                                                                                                                          │ │
│ │ - web/index.html (update copyAndGo function)                                                                                                                                                             │ │
│ │                                                                                                                                                                                                          │ │
│ │ Phase 3: Flutter Integration                                                                                                                                                                             │ │
│ │                                                                                                                                                                                                          │ │
│ │ I will provide complete code, you/Joe test:                                                                                                                                                              │ │
│ │ 1. InviteChannel - Method channel listener for native bridge                                                                                                                                             │ │
│ │ 2. ClaimParams parser - Accept token|tkn, ref|new from URLs                                                                                                                                              │ │
│ │ 3. ReferralService - HTTP client for redeemReferral                                                                                                                                                      │ │
│ │ 4. applyClaim() - Orchestration: redeem token OR apply ref directly                                                                                                                                      │ │
│ │ 5. Wire to main() + pasteboard check on first launch (300ms delay)                                                                                                                                       │ │
│ │                                                                                                                                                                                                          │ │
│ │ Files created/modified:                                                                                                                                                                                  │ │
│ │ - lib/services/invite_channel.dart (new)                                                                                                                                                                 │ │
│ │ - lib/services/referral_service.dart (new or merge with existing)                                                                                                                                        │ │
│ │ - lib/main.dart (modify app boot)                                                                                                                                                                        │ │
│ │ - lib/services/pasteboard_attribution_service.dart (update payload format)                                                                                                                               │ │
│ │                                                                                                                                                                                                          │ │
│ │ Phase 4: iOS Native (Swift)                                                                                                                                                                              │ │
│ │                                                                                                                                                                                                          │ │
│ │ I will provide complete code, you/Joe test in Xcode:                                                                                                                                                     │ │
│ │ 1. InviteBridge.swift - Method channel bridge (Swift → Flutter)                                                                                                                                          │ │
│ │ 2. AppDelegate.swift - NSUserActivity handler for App Clip handoff                                                                                                                                       │ │
│ │ 3. SceneDelegate.swift - Universal Link handler for /claim routes                                                                                                                                        │ │
│ │ 4. Wire bridge messenger to Flutter engine                                                                                                                                                               │ │
│ │                                                                                                                                                                                                          │ │
│ │ Files created/modified:                                                                                                                                                                                  │ │
│ │ - ios/Runner/InviteBridge.swift (new)                                                                                                                                                                    │ │
│ │ - ios/Runner/AppDelegate.swift (modify)                                                                                                                                                                  │ │
│ │ - ios/Runner/SceneDelegate.swift (modify/create)                                                                                                                                                         │ │
│ │                                                                                                                                                                                                          │ │
│ │ Phase 5: App Clip Target                                                                                                                                                                                 │ │
│ │                                                                                                                                                                                                          │ │
│ │ I will provide code + step-by-step Xcode guide:                                                                                                                                                          │ │
│ │ 1. Instructions for creating App Clip target in Xcode                                                                                                                                                    │ │
│ │ 2. InviteClipView.swift - SwiftUI one-screen UI                                                                                                                                                          │ │
│ │ 3. Clip SceneDelegate for URL parsing                                                                                                                                                                    │ │
│ │ 4. Entitlements configuration                                                                                                                                                                            │ │
│ │ 5. App Store Connect experience setup guide                                                                                                                                                              │ │
│ │                                                                                                                                                                                                          │ │
│ │ New target + files:                                                                                                                                                                                      │ │
│ │ - App Clip target (you create in Xcode)                                                                                                                                                                  │ │
│ │ - Clip/InviteClipView.swift (new)                                                                                                                                                                        │ │
│ │ - Clip/ClipSceneDelegate.swift (new)                                                                                                                                                                     │ │
│ │ - Clip.entitlements (new)                                                                                                                                                                                │ │
│ │                                                                                                                                                                                                          │ │
│ │ Questions Needing Answers Before Execution:                                                                                                                                                              │ │
│ │                                                                                                                                                                                                          │ │
│ │ 1. Firebase config: Confirm us-central1 and teambuilder-plus-fe74d?                                                                                                                                      │ │
│ │ 2. Function naming: Keep existing names or use Joe's *Fn suffix?                                                                                                                                         │ │
│ │ 3. Existing functions: Replace or merge with Joe's TypeScript versions?                                                                                                                                  │ │
│ │ 4. Users lookup: Use referralCodes collection or direct users/{ref}?                                                                                                                                     │ │
│ │ 5. SessionManager API: Confirm exact method signature for setReferralData?                                                                                                                               │ │
│ │                                                                                                                                                                                                          │ │
│ │ Acceptance Criteria (Joe's Go/No-Go):                                                                                                                                                                    │ │
│ │                                                                                                                                                                                                          │ │
│ │ ✅ Clip path: CTA → Clip shows "Invited by {Name}" → Install → Sponsor visible without extra taps                                                                                                         │ │
│ │ ✅ Already-installed: Smart App Banner → /claim → Sponsor appears                                                                                                                                         │ │
│ │ ✅ Store-only: Magic-link prompt resolves sponsor in one tap                                                                                                                                              │ │
│ │ ✅ Fallback: Private mode/blocked clipboard succeeds via SMS/QR dialog                                                                                                                                    │ │
│ │                                                                                                                                                                                                          │ │
│ │ Execution Order:                                                                                                                                                                                         │ │
│ │                                                                                                                                                                                                          │ │
│ │ 1. You answer Q1-Q5 above                                                                                                                                                                                │ │
│ │ 2. I execute Phase 1 + 2 (Backend + Web) - deploy ready                                                                                                                                                  │ │
│ │ 3. I provide Phase 3-5 code (Flutter + iOS + Clip)                                                                                                                                                       │ │
│ │ 4. You/Joe test in Xcode - iterate on issues                                                                                                                                                             │ │
│ │ 5. You configure App Store Connect - App Clip experiences                                                                                                                                                │ │
│ │ 6. Real device testing - all 4 attribution paths                                                                                                                                                         │ │
│ │ 7. Submit to App Store with reviewer notes                                                                                                                                                               │ │
│ │                                                                                                                                                                                                          │ │
│ │ Ready to proceed once questions answered.   