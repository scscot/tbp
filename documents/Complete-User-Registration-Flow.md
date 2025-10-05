📱 Complete User Registration Flow

Scenario 1: App Already Installed (Universal Link Works)

Step 1: User Receives Invite
Sponsor Sarah sends invite to new user John
- Sarah opens Team Build Pro app → taps "Invite" → shares link via text/email
- John receives: https://teambuildpro.com/?ref=88888888&t=3

Step 2: John Taps the Link (Mobile Safari/Chrome)
- Link opens in browser
- Page redirects to: https://teambuildpro.com/claim.html?ref=88888888&t=3&_ul=1
- claim.html loads and immediately attempts clipboard write
- Universal Link triggers before page fully renders

Step 3: Universal Link Triggers (Best Case)

✅ iOS recognizes Universal Link: teambuildpro.com/claim.html?ref=88888888&t=3&_ul=1
App opens immediately (page never visible to user)


Step 4: App Opens with Referral Data
- deep_link_service.dart catches Universal Link via app_links package
- _handleClaimUri() extracts ref=88888888, t=3
- Stores in SessionManager:
  - referralCode: 88888888
  - queryType: claim
  - source: claim_uri_initial (cold start) or claim_uri_stream (warm start)
  - campaignType: 3
- Navigates to NewRegistrationScreen

Step 5: Registration Screen Displays
John sees:
- ✅ Blue banner: "Invited by: Sarah Johnson" (sponsor name resolved via Cloud Function)
- Form fields: First Name, Last Name, Email, Password
- No "Tap to confirm your sponsor" button (hidden - already has referral)
- Privacy policy checkbox
- "Create Account" button

Step 6: John Fills Out Form
- Enters: John, Doe, john@example.com, password
- Checks privacy policy
- Taps "Create Account"

Step 7: Account Created
- registerUser Cloud Function called with:
  json
  {
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "sponsorReferralCode": "88888888",
    "referralSource": "constructor",
    "role": "user"
  }
  
- User account created in Firestore
- John's sponsor_id = Sarah's Firebase UID
- John added to Sarah's upline_refs array
- John redirected to EditProfileScreen (first-time setup)

---

Scenario 2: App NOT Installed OR Universal Link Doesn't Trigger (Clipboard Fallback)

Step 1: User Receives Invite
Sponsor Sarah sends invite to new user John
- Sarah opens Team Build Pro app → taps "Invite" → shares link via text/email
- John receives: https://teambuildpro.com/?ref=88888888&t=3

Step 2: John Taps the Link (Mobile Safari/Chrome)
- Link opens in browser
- Page redirects to: https://teambuildpro.com/claim.html?ref=88888888&t=3&_ul=1
- claim.html loads

Step 3: Universal Link Doesn't Trigger
- Possible reasons:
  - App not installed
  - AASA cache issue
  - User came via TestFlight "View in TestFlight" button
  - iOS didn't recognize the Universal Link

Step 4: claim.html Executes Fallback Flow
```javascript
// claim.html runs automatically:
1. Mints token via issueReferralV2 Cloud Function
   Response: { token: "be8dd61f97e56d070f26cb469c8a323e" }

2. Creates TBP payload:
   TBP_REF:88888888;TKN:be8dd61f...;T:3;V:2

3. Attempts clipboard write (no user gesture)
   - navigator.clipboard.writeText() → FAILS (iOS restriction)
   - legacyCopy() fallback → FAILS

4. Shows huge "Continue" button (auto-focused, scrolled into view)
   - Button text: "Continue"
   - Instructions: "Tap below to continue"
```

Step 5: John Taps "Continue" Button
- User gesture triggers clipboard write
- TBP_REF:88888888;TKN:be8dd61f...;T:3;V:2 → clipboard ✅
- Page redirects to App Store

Step 6: App Store / TestFlight Opens
- If not installed: Download from App Store
- If TestFlight user: "View in TestFlight" → "Open"
- App opens normally (NOT via Universal Link)

Step 7: App Opens Without Deep Link Data
- No Universal Link triggered
- No Branch deferred data
- App starts with empty referral state
- Navigates to NewRegistrationScreen

Step 8: Registration Screen - Clipboard Fallback Activates
John sees:
- No blue banner (no referral yet)
- Form fields: First Name, Last Name, Email, Password
- 🔵 Blue button: "Tap to confirm your sponsor" (prominent)
- Privacy policy checkbox
- "Create Account" button

Step 9: John Taps "Tap to confirm your sponsor"
- iOS shows: "Allow paste from [source]?" permission dialog
- John taps "Allow"
- _consumeClipboardIfPresent() reads clipboard
- Parses TBP_REF payload:
  ```dart
  TBP_REF:88888888;TKN:be8dd61f...;T:3;V:2
  → ref=88888888, token=be8dd61f..., t=3
  ```
- Fetches sponsor name via getUserByReferralCode Cloud Function
  ```
  GET /getUserByReferralCode?code=88888888
  Response: {firstName: "Sarah", lastName: "Johnson"}
  ```
- Stores in SessionManager:
  - referralCode: 88888888
  - sponsorName: Sarah Johnson
  - source: clipboard_gesture
  - campaignType: 3
- setState() triggers UI update

Step 10: Banner Appears!
- ✅ Blue banner: "Invited by: Sarah Johnson"
- Button disappears (already has referral)
- Clipboard cleared (prevents re-use)

Step 11-12: Same as Scenario 1
- John fills form, creates account
- Referral properly attributed to Sarah
- Success! 🎉

---

Scenario 3: User Manually Copies TBP Payload

If John Somehow Has the Raw TBP Payload
Maybe someone sent John the raw payload via text message: `TBP_REF:88888888;TKN:abc123;T:3;V:2`

Step 1: John Opens App Directly
- Downloads from App Store
- Opens app
- No deep link data

Step 2: John Copies the Payload
- From text message or email
- Clipboard now contains: `TBP_REF:88888888;TKN:abc123;T:3;V:2`

Step 3: Registration Screen Shows Button
- 🔵 Blue button: "Tap to confirm your sponsor" (visible when no referral)

Step 4: John Taps the Button
- Same flow as Scenario 2, Step 9
- Clipboard parsed successfully
- Banner appears: "Invited by: Sarah Johnson"
- Account created with attribution

---

Flow Diagram Summary


User taps invite link
         
    Web landing page
    "Invited by Sarah"
         
  Tap "Open Team Build Pro"
         
    ┌─────────────┐
    │ App Status? │
    └─────────────┘
         
    ┌────┴────┐
    │         │
INSTALLED  NOT INSTALLED
    │         │
             
Opens    App Store
instantly    
    │    Download
    │         
    │    Install & Open
    │         
    │    Branch deferred
    │    deep link
    │         │
    └────┬────┘
         
Registration Screen
"Invited by Sarah"
         
   Fill form
         
  Create Account
         
    SUCCESS! 🎉
Sarah gets notification:
"John joined your team!"


---

What Happens to Sarah (Sponsor)

Real-time Notification
When John completes registration:
1. Cloud Function registerUser completes
2. Sarah's directSponsorCount increments
3. If Sarah reaches milestone (e.g., 4 direct sponsors):
   - notifyOnMilestoneReached trigger fires
   - FCM notification sent to Sarah:
     - Title: "🎉 Milestone Reached!"
     - Body: "You now have 4 team members!"
4. Standard notification also created:
   - "John Doe joined your team!"

Sarah's App Updates
- Network screen auto-refreshes
- John appears in "My Team" list
- Team count badge updates

---

Privacy & UX Wins

✅ No clipboard reads at launch - respects iOS permissions
✅ No "we detected" language - not creepy
✅ No modals/dialogs - seamless flow
✅ Universal Link fallback works - app or store, never broken
✅ Deferred deep linking - attribution even after App Store
✅ Paste as rare fallback - hidden until needed
✅ Analytics tracked - can measure each path's success

This is the world-class, enterprise-grade invite flow! 🚀

---

Technical Implementation Details

Files Modified
- web/index.html - "Open Team Build Pro" button with Universal Link fallback
- lib/services/invite_link_parser.dart - NEW - Parses invite URLs
- lib/services/clipboard_helper.dart - Uses InviteLinkParser for URL parsing
- lib/screens/new_registration_screen.dart - "I have an invite link" fallback UI
- lib/services/analytics_service.dart - Invite link paste analytics
- lib/services/deep_link_service.dart - Branch deferred deep linking

Key Configuration
- Universal Link base: https://teambuildpro.com/
- AASA configured for: /?ref= and /?new=
- App Store ID: 6751211622
- Branch SDK: flutter_branch_sdk ^8.0.0
- Remote Config flag: referral_clipboard_offer_enabled

Analytics Events
- invite_link_paste_clicked - User tapped paste button
- invite_link_parse_success - Link parsed successfully (includes token_length)
- invite_link_parse_failure - Parse failed (includes reason: no_query_param, unrecognized_host, malformed_uri, etc.)

---

Last Updated: January 2025
Version: 1.0.31+61
