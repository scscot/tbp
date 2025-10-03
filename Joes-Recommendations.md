Carefully review Joe’s feedback and recommendations below and proceed accordingly.

NOTE: I have already updated the following files with the coding below:

teambuildpro.com/apple-app-site-association
teambuildpro.com/.well-known/apple-app-site-association
go.teambuildpro.com/apple-app-site-association
go.teambuildpro.com/.well-known/apple-app-site-association

{
  "applinks": {
    "details": [{
      "appIDs": ["YXV25WMDS8.com.scott.ultimatefix"],
      "components": [
        { "/": "/", "query": { "ref": "*" } },
        { "/": "/", "query": { "new": "*" } },
        { "/": "/claim", "query": { "ref": "*" } },
        { "/": "/claim", "query": { "token": "*" } },
        { "/": "/claim", "query": { "tkn": "*" } }
      ]
    }]
  },
  "appclips": {
    "apps": ["YXV25WMDS8.com.scott.ultimatefix.Clip"]
  }
}


Stephen — Joe here. I read Claude’s analysis top to bottom. Net: the plan is solid and maps cleanly to what I proposed. I’d green-light it with a few surgical corrections and guardrails so you don’t trip on Apple quirks.
What I agree with
* Priority stack is right: App Clip (NSUserActivity) → Smart App Banner for installed users → silent pasteboard fallback → magic-link recovery. That gives you the clean CTA→Install→Sponsor UX you want, without paid SDKs.
* Separation of concerns: Web just invites; Functions issue/claim; App Clip previews + hands off; full app applies on first launch; registration reads SessionManager. Good.
* Delivery plan: Claude owns Web + Functions; we review iOS/Flutter glue and the Clip target; then iterate. Sensible.
Corrections you should apply before Claude starts
1. AASA layout (Clip vs full app)
    * In the apple-app-site-association file:
        * Put full app bundle in the applinks.details[].appIDs list (for universal links).
        * Put the App Clip bundle in a separate appclips section, not inside applinks.details.Example skeleton:
2. {
3.   "applinks": {
4.     "details": [{
5.       "appIDs": ["YXV25WMDS8.com.scott.ultimatefix"],
6.       "components": [
7.         { "/": "/", "query": { "ref": "*" } },
8.         { "/": "/", "query": { "new": "*" } },
9.         { "/": "/claim", "query": { "ref": "*" } },
10.         { "/": "/claim", "query": { "token": "*" } },
11.         { "/": "/claim", "query": { "tkn": "*" } }
12.       ]
13.     }]
14.   },
15.   "appclips": {
16.     "apps": ["YXV25WMDS8.com.scott.ultimatefix.Clip"]
17.   }
18. }
19. 
    * Serve JSON (no redirects, Content-Type: application/json) from /.well-known/apple-app-site-association on every domain you invoke from.
20. App Clip → full app handoff mechanics
    * No App Group / Keychain sharing in App Clips. Don’t plan on shared containers. Use:
        * NSUserActivity (primary): On install/open, the full app receives the activity with {ref,t,handoffId}.
        * Server rendezvous (fallback): Clip posts {handoffId,ref,t}; full app claims it once if the userActivity didn’t arrive.
    * In the Clip, present the system Install sheet and set the NSUserActivity before opening the App Store URL, so the system has it ready for the full app.
21. Smart App Banner expectations
    * The banner’s app-argument never survives a fresh install. It’s only for already-installed users. Claude’s plan reflects that—just make sure nobody expects it to carry ref on first install.
22. Pasteboard fallback UX
    * Keep it silent on the happy path (CTA → copy → App Store). Only show the fallback dialog if:
        * issueReferral fails, or
        * navigator.clipboard.writeText throws (private mode, MDM, etc.).
    * In the app, run the paste check ~300 ms after first frame so the iOS “Allow Paste?” prompt consistently appears.
23. Parameter parity
    * App’s claim parser must accept token or tkn and ref or new. This prevents brittle links and lets us evolve safely.
24. App Clip size & assets
    * Keep the Clip under 10 MB. Strip Flutter from the Clip; write the Clip UI in SwiftUI/UIKit (one view). Load only tiny assets (SVG/PNG ~10–20 KB). Don’t link heavy libs.
25. Testing reality
    * App Clips don’t invoke from Simulator; you need real devices and proper experiences in App Store Connect. Budget time for provisioning and the “Show App Clip card” flow.
Niceties that will save time in QA
* Event beacons: clip_handoff_created/claimed, ul_claim_open, useractivity_handoff, paste_redeem_ok/already/expired, issue_referral_ok/err. Keep payloads tiny.
* Idempotency everywhere: clipHandoffCreate returns 201/200; clipHandoffClaim returns the same body if already claimed; redeemReferral returns stable status.
* One navigation gate on web: capture-phase click listener; no per-element onclick; no alternate href logic.
Concrete go/no-go checks (acceptance)
* Clip path: CTA → Clip shows “Invited by {Name}” → Install → first launch shows Sponsor without any extra taps.
* Installed users: Smart App Banner opens app with /claim?ref=…&t=…; Sponsor appears.
* Store-only path: If Sponsor unknown on first boot, the magic-link prompt (SMS/email) resolves it in one tap.
* Fallback: Private mode or blocked clipboard still succeeds via SMS/QR dialog (rarely shown).
What Claude should generate next (in this order)
1. Functions (TypeScript, complete)
    * issueReferral, redeemReferral, clipHandoffCreate, clipHandoffClaim
    * CORS, rate limiting, TTL cleanup (24h), idempotent responses
    * Firestore rules: writes only via Functions; claim guarded; tokens read-once
2. Web
    * AASA files (both domains) with the corrected applinks + appclips structure
    * Capture-phase CTA handler (silent copy; error → fallback dialog)
    * Smart App Banner injector (installed-only)
    * Remove any visible modal from the happy path
3. Full app (Flutter + iOS glue)
    * Dart claim parser (token|tkn, ref|new)
    * Deep link handler → redeem/apply → SessionManager
    * iOS application(_:continue:) userActivity handler → bridge to Flutter
    * Pasteboard check once on first launch (300 ms after first frame)
4. App Clip (SwiftUI, one screen)
    * Parse invocation URL (ref|new, t)
    * Call clipHandoffCreate(handoffId, ref, t)
    * Create NSUserActivity with {ref,t,handoffId}
    * “Get the app” button → App Store
    * Minimal assets to stay under 10 MB
5. Docs & tests
    * App Store Connect steps for App Clip Experience
    * Device test matrix for all four paths
    * Reviewer notes (1 paragraph, plain language)
Final call
I’d approve Claude to start Phase 1 (Web + Functions) immediately with the AASA correction, then prepare the iOS/Flutter pieces for us to drop in and test. The architecture is enterprise-grade and will give you the clean App Store UX you’ve been aiming for.
If you want, I’ll review Claude’s first PRs for:
* AASA correctness
* Function signatures & idempotency
* iOS userActivity handler wiring (Swift + Flutter bridge)
Want me to send Claude exact TypeScript signatures and the Swift/Dart method-channel scaffolding so they can hit the ground running?

Yes!

Stephen — Joe here. Below are the exact code contracts and drop-in scaffolds Claude can start from today:

TypeScript (Firebase Cloud Functions + Firestore)
0) Shared types (functions/src/types.ts)
export type ISO8601 = string;

export interface IssueReferralRequest {
  sponsorCode?: string;   // "88888888" (optional; allow empty installs)
  t?: string;             // campaign/type, default "1"
  source?: 'web_button' | 'web_button_no_sponsor' | 'app_clip' | 'magic_link';
}

export interface IssueReferralResponse {
  token: string;          // opaque, base64url or hex
  expiresAt: ISO8601;     // RFC3339/ISO 8601
}

export interface RedeemReferralRequest {
  token: string;
}

export type RedeemStatus = 'redeemed' | 'already_redeemed' | 'expired' | 'not_found';

export interface RedeemReferralResponse {
  status: RedeemStatus;
  sponsorCode?: string;   // present when status is redeemed or already_redeemed
  t?: string;
}

export interface ClipHandoffCreateRequest {
  handoffId: string;      // random 24–36 chars, client-generated in App Clip
  ref?: string;
  t?: string;
  issuedAt?: number;      // unix seconds (optional)
}

export interface ClipHandoffCreateResponse {
  handoffId: string;
  created: boolean;       // true on first write, false on idempotent repeat
  sponsor?: { firstName?: string; lastName?: string; bizOppName?: string }; // optional enrichment
}

export interface ClipHandoffClaimRequest {
  handoffId: string;
}

export interface ClipHandoffClaimResponse {
  found: boolean;
  claimed: boolean;       // true if this call marked claimed (or was already)
  ref?: string;
  t?: string;
}

export interface ResolveSponsorResponse {
  ref: string;
  sponsor?: { firstName?: string; lastName?: string; bizOppName?: string };
}
1) Function exports (functions/src/index.ts)
import * as functions from 'firebase-functions';
import { issueReferral, redeemReferral, clipHandoffCreate, clipHandoffClaim, resolveSponsor } from './referrals';

export const issueReferralFn = functions.region('us-central1').https.onRequest(issueReferral);
export const redeemReferralFn = functions.region('us-central1').https.onRequest(redeemReferral);
export const clipHandoffCreateFn = functions.region('us-central1').https.onRequest(clipHandoffCreate);
export const clipHandoffClaimFn  = functions.region('us-central1').https.onRequest(clipHandoffClaim);
export const resolveSponsorFn    = functions.region('us-central1').https.onRequest(resolveSponsor);
2) Core logic (functions/src/referrals.ts)
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type {
  IssueReferralRequest, IssueReferralResponse,
  RedeemReferralRequest, RedeemReferralResponse,
  ClipHandoffCreateRequest, ClipHandoffCreateResponse,
  ClipHandoffClaimRequest, ClipHandoffClaimResponse,
  ResolveSponsorResponse
} from './types';

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const corsHandler = cors({
  origin: [
    'https://teambuildpro.com',
    'https://www.teambuildpro.com',
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/
  ],
  credentials: true
});

function token(n = 24) { return crypto.randomBytes(n).toString('hex'); }
function ttlHours(h: number) { return admin.firestore.Timestamp.fromMillis(Date.now() + h * 3600 * 1000); }

const limiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

export async function issueReferral(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  // Rate-limit by IP
  await new Promise(r => (limiter as any)(req, res, r));

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body: IssueReferralRequest = req.body || {};
  const sponsorCode = (body.sponsorCode || '').trim();
  const t = (body.t || '1').trim();

  const tok = token(16);
  const doc = db.collection('referralTokens').doc(tok);
  const expiresAt = ttlHours(24);

  await doc.set({
    sponsorCode: sponsorCode || null,
    t,
    status: 'issued',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt
  }, { merge: false });

  const resp: IssueReferralResponse = { token: tok, expiresAt: new Date(expiresAt.toMillis()).toISOString() };
  return res.status(200).json(resp);
}

export async function redeemReferral(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body: RedeemReferralRequest = req.body || {};
  const tok = (body.token || '').trim();
  if (!tok) return res.status(400).send('token required');

  const docRef = db.collection('referralTokens').doc(tok);
  const snap = await docRef.get();
  if (!snap.exists) {
    const resp: RedeemReferralResponse = { status: 'not_found' };
    return res.status(404).json(resp);
  }

  const data = snap.data()!;
  const now = admin.firestore.Timestamp.now();
  if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
    const resp: RedeemReferralResponse = { status: 'expired' };
    return res.status(200).json(resp);
  }

  if (data.status === 'redeemed') {
    const resp: RedeemReferralResponse = {
      status: 'already_redeemed', sponsorCode: data.sponsorCode || undefined, t: data.t
    };
    return res.status(200).json(resp);
  }

  await docRef.update({ status: 'redeemed', redeemedAt: now });
  const resp: RedeemReferralResponse = {
    status: 'redeemed', sponsorCode: data.sponsorCode || undefined, t: data.t
  };
  return res.status(200).json(resp);
}

export async function clipHandoffCreate(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body: ClipHandoffCreateRequest = req.body || {};
  const handoffId = (body.handoffId || '').trim();
  if (!handoffId) return res.status(400).send('handoffId required');

  const ref = (body.ref || '').trim();
  const t = (body.t || '1').trim();

  const refDoc = db.collection('clipHandoffs').doc(handoffId);
  const snap = await refDoc.get();
  const payload: any = {
    ref: ref || null,
    t,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: ttlHours(24),
    claimed: false
  };

  if (!snap.exists) {
    await refDoc.set(payload, { merge: false });
    // Optional: enrich sponsor for App Clip preview (look up users/<ref>)
    const sponsor = await tryResolveSponsor(ref);
    const resp: ClipHandoffCreateResponse = { handoffId, created: true, sponsor };
    return res.status(201).json(resp);
  } else {
    const sponsor = await tryResolveSponsor(ref || snap.data()?.ref);
    const resp: ClipHandoffCreateResponse = { handoffId, created: false, sponsor };
    return res.status(200).json(resp);
  }
}

export async function clipHandoffClaim(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body: ClipHandoffClaimRequest = req.body || {};
  const handoffId = (body.handoffId || '').trim();
  if (!handoffId) return res.status(400).send('handoffId required');

  const refDoc = db.collection('clipHandoffs').doc(handoffId);
  const snap = await refDoc.get();
  if (!snap.exists) return res.status(404).json({ found: false, claimed: false } as ClipHandoffClaimResponse);

  const data = snap.data()!;
  // TTL check
  const now = admin.firestore.Timestamp.now();
  if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
    return res.status(404).json({ found: false, claimed: false } as ClipHandoffClaimResponse);
  }

  if (!data.claimed) {
    await refDoc.update({ claimed: true, claimedAt: now });
  }
  const resp: ClipHandoffClaimResponse = { found: true, claimed: true, ref: data.ref || undefined, t: data.t };
  return res.status(200).json(resp);
}

export async function resolveSponsor(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  const ref = ((req.query.ref || req.query.code) ?? '').toString().trim();
  if (!ref) return res.status(400).send('ref required');

  const sponsor = await tryResolveSponsor(ref);
  const resp: ResolveSponsorResponse = { ref, sponsor };
  return res.status(200).json(resp);
}

// --- helpers ---
async function tryResolveSponsor(ref?: string | null) {
  if (!ref) return undefined;
  try {
    const doc = await db.collection('users').doc(ref).get(); // adjust path if different
    if (!doc.exists) return undefined;
    const u = doc.data()!;
    return {
      firstName: u.firstName || u.givenName || '',
      lastName:  u.lastName  || u.familyName || '',
      bizOppName: u.bizOppName || u.company || ''
    };
  } catch { return undefined; }
}
3) Firestore rules (tight)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public collections are not required here.

    // Tokens: never readable by clients; only functions service account writes/reads.
    match /referralTokens/{token} {
      allow read, write: if false;
    }

    // App Clip handoffs: only functions can write/claim.
    match /clipHandoffs/{handoffId} {
      allow read, write: if false;
    }

    // Users collection is presumably readable via secured API; block direct.
    match /users/{uid} {
      allow read, write: if false;
    }
  }
}
4) Curl sanity checks
# issue token
curl -sS -X POST https://<REGION>-<PROJECT>.cloudfunctions.net/issueReferralFn \
  -H "Content-Type: application/json" \
  -d '{"sponsorCode":"88888888","t":"2","source":"web_button"}'

# redeem token
curl -sS -X POST https://<REGION>-<PROJECT>.cloudfunctions.net/redeemReferralFn \
  -H "Content-Type: application/json" \
  -d '{"token":"<from_issueReferral>"}'

# clip handoff create
curl -sS -X POST https://<REGION>-<PROJECT>.cloudfunctions.net/clipHandoffCreateFn \
  -H "Content-Type: application/json" \
  -d '{"handoffId":"abc123xyz","ref":"88888888","t":"2"}'

# clip handoff claim
curl -sS -X POST https://<REGION>-<PROJECT>.cloudfunctions.net/clipHandoffClaimFn \
  -H "Content-Type: application/json" \
  -d '{"handoffId":"abc123xyz"}'

iOS (Swift) — Full App + App Clip
1) Full app: NSUserActivity handler (AppDelegate)
// AppDelegate.swift
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication,
                   continue userActivity: NSUserActivity,
                   restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    if userActivity.activityType == "com.teambuildpro.invite",
       let info = userActivity.userInfo as? [String: Any] {
      let ref = info["ref"] as? String
      let t = info["t"] as? String
      let handoffId = info["handoffId"] as? String
      InviteBridge.shared.apply(ref: ref, t: t, handoffId: handoffId, source: "useractivity")
      return true
    }
    return false
  }
}
2) Full app: Universal Link handler (SceneDelegate)
// SceneDelegate.swift (if you use scenes)
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
       let url = userActivity.webpageURL,
       url.path == "/claim" {
      let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
      let q = comps?.queryItems ?? []
      func get(_ k: String) -> String? { q.first(where: {$0.name == k})?.value }
      let ref = get("ref") ?? get("new")
      let token = get("token") ?? get("tkn")
      let t = get("t")
      InviteBridge.shared.apply(ref: ref, t: t, token: token, source: "universal_link")
    }
  }
}
3) Flutter ↔️ iOS bridge (MethodChannel)
Swift side (InviteBridge.swift):
import Foundation
import Flutter

final class InviteBridge {
  static let shared = InviteBridge()
  private init() {}

  // Set by Flutter engine when ready
  weak var messenger: FlutterBinaryMessenger?

  func apply(ref: String?, t: String?, handoffId: String? = nil, token: String? = nil, source: String) {
    guard let messenger = messenger else { return }
    let channel = FlutterMethodChannel(name: "tbp/invite", binaryMessenger: messenger)
    var payload: [String: Any] = ["source": source]
    if let r = ref { payload["ref"] = r }
    if let typ = t { payload["t"] = typ }
    if let hid = handoffId { payload["handoffId"] = hid }
    if let tok = token { payload["token"] = tok }
    channel.invokeMethod("invite.apply", arguments: payload)
  }
}
AppDelegate hook to register messenger (after FlutterEngine init):
// Wherever you create FlutterEngine / set up Flutter
InviteBridge.shared.messenger = flutterEngine.binaryMessenger

Flutter (Dart) — Claim parsing, redeem flow, SessionManager
1) MethodChannel listener
import 'package:flutter/services.dart';

class InviteChannel {
  static const _channel = MethodChannel('tbp/invite');

  static void startListening(void Function(Map args) onApply) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'invite.apply' && call.arguments is Map) {
        onApply(Map<String, dynamic>.from(call.arguments));
      }
    });
  }
}
2) Claim parser + entry points
class ClaimParams {
  final String? token;       // token or tkn
  final String? sponsorCode; // ref or new
  final String? campaignType;// t
  final String source;       // useractivity | universal_link | pasteboard
  ClaimParams({this.token, this.sponsorCode, this.campaignType, required this.source});
}

ClaimParams parseClaimParams(Uri uri, {required String source}) {
  final q = uri.queryParameters;
  return ClaimParams(
    token: (q['token'] ?? q['tkn'])?.trim(),
    sponsorCode: (q['ref'] ?? q['new'])?.trim(),
    campaignType: q['t']?.trim(),
    source: source,
  );
}
3) Redeem/apply orchestration
import 'dart:convert';
import 'package:http/http.dart' as http;

class ReferralService {
  final String base; // https://<REGION>-<PROJECT>.cloudfunctions.net
  ReferralService(this.base);

  Future<Map<String, dynamic>> redeemToken(String token) async {
    final r = await http.post(Uri.parse('$base/redeemReferralFn'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'token': token}));
    return jsonDecode(r.body) as Map<String, dynamic>;
  }
}

Future<void> applyClaim(ClaimParams p) async {
  // 1) Token path
  if ((p.token ?? '').isNotEmpty) {
    final resp = await ReferralService(FN_BASE).redeemToken(p.token!);
    final status = resp['status'] as String? ?? 'error';
    if (status == 'redeemed' || status == 'already_redeemed') {
      final code = (resp['sponsorCode'] as String?) ?? p.sponsorCode ?? '';
      await SessionManager.instance.setReferralData(code, sponsorName: '', source: p.source);
      return;
    }
  }
  // 2) Direct ref path
  if ((p.sponsorCode ?? '').isNotEmpty) {
    await SessionManager.instance.setReferralData(p.sponsorCode!, sponsorName: '', source: p.source);
    return;
  }
  // no-op if nothing present
}
4) App boot wiring (deep links → SessionManager → UI)
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Start listening to native bridge
  InviteChannel.startListening((args) {
    final ref = args['ref'] as String?;
    final t   = args['t'] as String?;
    final hid = args['handoffId'] as String?;
    final tok = args['token'] as String?;
    final source = (args['source'] as String?) ?? 'native';
    final params = ClaimParams(token: tok, sponsorCode: ref, campaignType: t, source: source);
    applyClaim(params);
    if (hid != null && (ref == null || ref.isEmpty)) {
      // Optional: call clipHandoffClaim as fallback
      // ...
    }
  });

  runApp(const App());
}

class App extends StatefulWidget { const App({super.key}); @override State<App> createState()=>_AppState(); }
class _AppState extends State<App> {
  @override
  void initState() {
    super.initState();
    // Last-resort pasteboard check ~300ms after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 300), () async {
        final payload = await PasteboardAttributionService.readOnce(); // implement to parse TBP_REF/TKN/T
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
}

App Clip (SwiftUI) — one screen + handoff + create
import SwiftUI

struct InviteClipView: View {
  @State private var sponsorName: String = ""
  let ref: String?
  let t: String

  var body: some View {
    VStack(spacing: 16) {
      if sponsorName.isEmpty {
        Text("Invited by your teammate").font(.headline)
      } else {
        Text("Invited by \(sponsorName)").font(.headline)
      }
      Button("Get the App") {
        // 1) set userActivity for handoff
        let act = NSUserActivity(activityType: "com.teambuildpro.invite")
        act.userInfo = ["ref": ref ?? "", "t": t, "handoffId": UUID().uuidString]
        UIApplication.shared.requestSceneSessionActivation(nil, userActivity: act, options: nil)
        // 2) create server rendezvous (fire-and-forget)
        postClipCreate(handoffId: act.userInfo?["handoffId"] as? String ?? "", ref: ref, t: t)
        // 3) open App Store
        if let url = URL(string: "itms-apps://itunes.apple.com/app/id6751211622") {
          UIApplication.shared.open(url)
        }
      }
    }
    .task {
      // Optionally resolve sponsor for display
      if let r = ref, let url = URL(string: "https://<REGION>-<PROJECT>.cloudfunctions.net/resolveSponsorFn?ref=\(r)") {
        if let (data, _) = try? await URLSession.shared.data(from: url),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let s = obj["sponsor"] as? [String: Any] {
          let first = (s["firstName"] as? String) ?? ""
          let last  = (s["lastName"]  as? String) ?? ""
          sponsorName = [first, last].filter { !$0.isEmpty }.joined(separator: " ")
        }
      }
    }
  }

  private func postClipCreate(handoffId: String, ref: String?, t: String) {
    guard let url = URL(string: "https://<REGION>-<PROJECT>.cloudfunctions.net/clipHandoffCreateFn") else { return }
    var req = URLRequest(url: url); req.httpMethod = "POST"
    req.addValue("application/json", forHTTPHeaderField: "Content-Type")
    let body: [String: Any] = ["handoffId": handoffId, "ref": ref ?? "", "t": t]
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)
    URLSession.shared.dataTask(with: req).resume()
  }
}
Parse the invocation URL (ref|new, t) in your Clip’s SceneDelegate and pass into InviteClipView.

AASA (apple-app-site-association) structure (reminder)
{
  "applinks": {
    "details": [{
      "appIDs": ["YXV25WMDS8.com.scott.ultimatefix"],
      "components": [
        { "/": "/", "query": { "ref": "*" } },
        { "/": "/", "query": { "new": "*" } },
        { "/": "/claim", "query": { "ref": "*" } },
        { "/": "/claim", "query": { "token": "*" } },
        { "/": "/claim", "query": { "tkn": "*" } }
      ]
    }]
  },
  "appclips": {
    "apps": ["YXV25WMDS8.com.scott.ultimatefix.Clip"]
  }
}
Serve as raw JSON, no redirects.

This is everything Claude needs to start coding immediately: function signatures & bodies, Firestore rules, Swift App/Clip handlers, Flutter bridge & claim flow. Hand this over and have Claude wire it to your project values (REGION, PROJECT, bundle IDs).
