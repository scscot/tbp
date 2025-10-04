📱 Complete User Registration Flow

Scenario 1: App Already Installed

Step 1: User Receives Invite
Sponsor Sarah sends invite to new user John
- Sarah opens Team Build Pro app → taps "Invite" → shares link via text/email
- John receives: `https://teambuildpro.com/?ref=88888888&t=2`

Step 2: John Taps the Link (Mobile Safari/Chrome)
- Link opens in browser
- Web page loads showing:
  - Invite bar: "You've been personally invited by Sarah Johnson" (with her photo)
  - Personalized headline based on referral type:
    - If `?new=` → "Pre-Build Your Foundation Before Launch!"
    - If `?ref=` → "Most Direct Sales Professionals Quit Within 90 Days..."
  - Helper text: "We'll open the app with your invite. If you don't have it yet, we'll take you to the App Store."
  - Primary button: 🔵 "Open Team Build Pro" (big, blue)
  - Secondary link: "Continue to App Store" (smaller, underlined)

Step 3: John Taps "Open Team Build Pro"
```
[Button disabled, opacity fades to 60%]
↓
Universal Link attempt: https://teambuildpro.com/?ref=88888888&t=2
↓ (50-200ms if app installed)
✅ iOS recognizes Universal Link
↓
App opens immediately
```

Step 4: App Opens with Referral Data
- Deep link service catches the Universal Link
- Extracts `ref=88888888` from URL
- Stores in SessionManager:
  - referralCode: `88888888`
  - queryType: `ref`
  - source: `constructor` (from deep link)
- Navigates to NewRegistrationScreen

Step 5: Registration Screen Displays
John sees:
- ✅ Blue banner: "Invited by: Sarah Johnson" (sponsor name resolved via Cloud Function)
- Form fields: First Name, Last Name, Email, Password
- No paste UI visible (completely hidden)
- Privacy policy checkbox
- "Create Account" button

Step 6: John Fills Out Form
- Enters: John, Doe, john@example.com, password
- Checks privacy policy
- Taps "Create Account"

Step 7: Account Created
- `registerUser` Cloud Function called with:
  ```json
  {
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "sponsorReferralCode": "88888888",
    "referralSource": "constructor",
    "role": "user"
  }
  ```
- User account created in Firestore
- John's `sponsor_id` = Sarah's Firebase UID
- John added to Sarah's `upline_refs` array
- John redirected to EditProfileScreen (first-time setup)

---

Scenario 2: App NOT Installed (Deferred Deep Link)

Step 1-3: Same as Above
John receives link, taps it, sees web page, taps "Open Team Build Pro"

Step 4: Universal Link Fails (App Not Installed)
```
Universal Link attempt: https://teambuildpro.com/?ref=88888888&t=2
↓ (1200ms timeout - nothing happens)
Timer expires, elapsed < 1600ms
↓
window.location.replace('https://apps.apple.com/app/id6751211622')
↓
✅ App Store opens
```

Step 5: App Store Opens
- John sees Team Build Pro app page
- Taps "GET" → Download/Install
- Behind the scenes: Branch SDK captures referral data:
  - Link clicked: `https://teambuildpro.com/?ref=88888888&t=2`
  - User fingerprint: device ID, IP, user agent
  - Attribution window starts

Step 6: App Installs & Opens for First Time
- John taps "Open" after install
- App launches
- `DeepLinkService.initialize()` runs:
  ```dart
  await FlutterBranchSdk.init();
  _branchSubscription = FlutterBranchSdk.listSession().listen((data) {
    // Deferred deep link data arrives!
  });
  ```

Step 7: Branch Delivers Deferred Deep Link
Branch SDK returns:
```json
{
  "+clicked_branch_link": true,
  "ref": "88888888",
  "~referring_link": "https://teambuildpro.com/?ref=88888888&t=2",
  "~channel": "web",
  "+match_guaranteed": true
}
```

Step 8: App Processes Deferred Data
```dart
// deep_link_service.dart:42-72
if (data['+clicked_branch_link'] == true) {
  final referralCode = data['ref'] ?? data['new'];
  _latestReferralCode = "88888888";
  _latestQueryType = "ref";

  await SessionManager.instance.setReferralData(
    "88888888",
    '',
    queryType: "ref"
  );

  _navigateToHomepage("88888888", "ref");
}
```

Step 9: Navigation to Registration
- Checks Remote Config for demo mode (likely OFF)
- Navigates to NewRegistrationScreen with:
  - referralCode: `88888888`
  - queryType: `ref`

Step 10: Registration Screen Displays
John sees:
- ✅ Blue banner: "Invited by: Sarah Johnson"
- Same form as Scenario 1
- No paste UI (completely hidden)

Step 11-12: Same as Scenario 1
- John fills form, creates account
- Referral properly attributed to Sarah
- Success! 🎉

---

Edge Case: User Copied Link Instead of Tapping

If John Copies the Link Text
Maybe John long-pressed the link and selected "Copy" instead of tapping it.

Step 1: John Opens App Store Directly
- Searches "Team Build Pro" manually
- Downloads and opens app
- No deep link or Branch data (organic install)

Step 2: App Opens to Registration
- No referral code in constructor
- No Branch deferred data
- Shows generic registration screen

Step 3: John Has the Link in Clipboard
His clipboard contains: `https://teambuildpro.com/?ref=88888888&t=2`

Step 4: "I have an invite link" Appears
After ~1 second:
- `ClipboardHelper.shouldOfferPaste()` checks:
  - ✅ iOS physical device
  - ✅ Remote Config enabled (`referral_clipboard_offer_enabled`)
  - ✅ `UIPasteboard.general.hasStrings` = true (safe, no modal)
- Small text button appears: "I have an invite link" (blue, underlined)

Step 5: John Taps "I have an invite link"
Paste UI reveals:
- Helper text: "If someone sent you an invite link, you can paste it here."
- 🔵 Button: "Paste invite link"

Step 6: John Taps "Paste invite link"
- First clipboard read (may show iOS paste permission sheet on iOS 16+)
- `ClipboardHelper.pastePlainText()` retrieves: `https://teambuildpro.com/?ref=88888888&t=2`
- Analytics: `invite_link_paste_clicked`

Step 7: Link Parsed
```dart
InviteLinkParser.parse("https://teambuildpro.com/?ref=88888888&t=2")
↓ Normalize (trim, strip punctuation, decode)
↓ Parse URI
↓ Extract query params
✅ Result: referralCode="88888888", queryType="ref"
```
- Analytics: `invite_link_parse_success` (token_length: 8)

Step 8: Referral Applied
```dart
SessionManager.instance.setReferralData(
  "88888888",
  "",
  queryType: "ref",
  source: "invite_link_paste_inline"
);
```
- Clipboard cleared (prevents re-processing)
- Screen reloads via `_initializeScreen()`

Step 9: Banner Appears
- HTTP request to `getUserByReferralCode?code=88888888`
- Response: `{firstName: "Sarah", lastName: "Johnson", ...}`
- ✅ Blue banner: "Invited by: Sarah Johnson"
- Paste UI hidden
- John continues with registration

Step 10: Account Created with Attribution
- Referral properly attributed to Sarah
- Source tracked as: `invite_link_paste_inline`

---

Flow Diagram Summary

```
User taps invite link
         ↓
    Web landing page
    "Invited by Sarah"
         ↓
  Tap "Open Team Build Pro"
         ↓
    ┌─────────────┐
    │ App Status? │
    └─────────────┘
         ↓
    ┌────┴────┐
    │         │
INSTALLED  NOT INSTALLED
    │         │
    ↓         ↓
Opens    App Store
instantly    ↓
    │    Download
    │         ↓
    │    Install & Open
    │         ↓
    │    Branch deferred
    │    deep link
    │         │
    └────┬────┘
         ↓
Registration Screen
"Invited by Sarah"
         ↓
   Fill form
         ↓
  Create Account
         ↓
    SUCCESS! 🎉
Sarah gets notification:
"John joined your team!"
```

---

What Happens to Sarah (Sponsor)

Real-time Notification
When John completes registration:
1. Cloud Function `registerUser` completes
2. Sarah's `directSponsorCount` increments
3. If Sarah reaches milestone (e.g., 4 direct sponsors):
   - `notifyOnMilestoneReached` trigger fires
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
- `web/index.html` - "Open Team Build Pro" button with Universal Link fallback
- `lib/services/invite_link_parser.dart` - NEW - Parses invite URLs
- `lib/services/clipboard_helper.dart` - Uses InviteLinkParser for URL parsing
- `lib/screens/new_registration_screen.dart` - "I have an invite link" fallback UI
- `lib/services/analytics_service.dart` - Invite link paste analytics
- `lib/services/deep_link_service.dart` - Branch deferred deep linking

Key Configuration
- Universal Link base: `https://teambuildpro.com/`
- AASA configured for: `/?ref=` and `/?new=`
- App Store ID: `6751211622`
- Branch SDK: `flutter_branch_sdk ^8.0.0`
- Remote Config flag: `referral_clipboard_offer_enabled`

Analytics Events
- `invite_link_paste_clicked` - User tapped paste button
- `invite_link_parse_success` - Link parsed successfully (includes token_length)
- `invite_link_parse_failure` - Parse failed (includes reason: `no_query_param`, `unrecognized_host`, `malformed_uri`, etc.)

---

Last Updated: January 2025
Version: 1.0.31+61
