# Team Build Pro Referral Tracking Test Script

## Prerequisites
- iOS device with Team Build Pro installed
- Xcode Console access for real-time logging
- Branch dashboard access for link creation
- Website hosting `teambuildpro.com` with AASA file

## Test Scenarios

### Scenario 1: Direct Universal Link (Immediate)
**Setup:**
1. Create test link: `https://teambuildpro.com/?ref=88888888&t=1`
2. Ensure AASA file is live at: `https://teambuildpro.com/.well-known/apple-app-site-association`

**Test Steps:**
1. Open Safari on iOS device
2. Navigate to test link
3. Tap "Open in Team Build Pro" banner
4. **Expected Result:** App opens directly to registration with referral code

**Logs to Capture (Xcode Console):**
```
🔗 Deep Link: App launched with URI: teambuildpro://...
🔍 Using fresh constructor referral code: 88888888
✅ NewRegistrationScreen: Referral data cached
```

### Scenario 2: Branch Deferred Deep Link (App Store Install)
**Setup:**
1. Create Branch link in dashboard:
   - URL: `https://teambuildpro.app.link/install`
   - Custom data: `{"ref": "88888888", "campaign": "test"}`
   - Fallback: `https://apps.apple.com/app/team-build-pro/id6751211622`

**Test Steps:**
1. Share Branch link via SMS/Email to test device
2. Tap link (app NOT installed)
3. Redirected to App Store → Download → Install → Open
4. **Expected Result:** App opens with deferred referral data

**Logs to Capture:**
```
🌿 Branch: Deferred deep link captured: 88888888
🔍 Using cached referral data
Cached referral code: 88888888
```

### Scenario 3: App Store Direct Link (Fallback)
**Setup:**
1. Use direct App Store link: `https://apps.apple.com/app/team-build-pro/id6751211622`
2. No query parameters (to confirm they don't pass through)

**Test Steps:**
1. Tap App Store link → Install → Open
2. **Expected Result:** Generic registration screen (no referral data)

**Logs to Capture:**
```
🔗 Deep Link: No initial URI found. Navigating to generic homepage.
🔍 No cached referral data found
```

### Scenario 4: Branch Link with App Installed (Immediate)
**Setup:**
1. Create Branch link: `https://teambuildpro.app.link/test123` with custom data `{"ref": "99999999"}`
2. App already installed on device

**Test Steps:**
1. Tap Branch link in Safari/Messages
2. **Expected Result:** App opens immediately with referral data

**Logs to Capture:**
```
🔗 Deep Link: App launched with URI: https://teambuildpro.app.link/test123
🌿 Branch: Session data received: {+clicked_branch_link: true, ref: 99999999}
🔍 Using fresh constructor referral code: 99999999
```

### Scenario 5: First Launch from Home Screen (Deferred Deep Link)
**Setup:**
1. Create Branch link with referral data
2. App Store install completed

**Test Steps:**
1. Do NOT tap "Open" button in App Store
2. Navigate to Home Screen → Tap app icon for first launch
3. **Expected Result:** App opens with deferred referral data

**Logs to Capture:**
```
🌿 Branch: SDK initialized
🌿 Branch: Session data received: {+clicked_branch_link: true, ref: 88888888}
🌿 Branch: Deferred deep link captured: 88888888
🔍 Using cached referral data
```

### Scenario 6: Cold Start Attribution Test
**Setup:**
1. App installed and opened once
2. Kill app completely (not just background)

**Test Steps:**
1. Tap Branch link → Should open app
2. Kill app via App Switcher
3. Tap Branch link again → Should open app with fresh data
4. **Expected Result:** Fresh referral data captured both times

**Logs to Capture:**
```
🔗 Deep Link: App launched with URI: [Branch URL]
🌿 Branch: Session data received: {+clicked_branch_link: true}
```

### Scenario 7: Sponsor Overwrite Protection Test
**Setup:**
1. Open app with referral code A
2. Start filling registration form
3. Tap different Branch link with referral code B

**Test Steps:**
1. Open app: `teambuildpro.com/?ref=AAAAA&t=1`
2. Enter first name and email in registration form
3. Tap link: `teambuildpro.app.link/xyz` (contains `ref=BBBBB`)
4. **Expected Result:** Dialog asking to confirm overwrite

**Logs to Capture:**
```
🔍 REGISTER: User has started entering form data
🌿 Branch: Deferred deep link captured: BBBBB
[Sponsor Overwrite Dialog displayed]
```

## Critical Validation Points

### 1. Referral Code Resolution Priority
Monitor these logs to confirm priority order:
- ✅ Constructor parameter (immediate deep link)
- ✅ Branch deferred data (App Store install)
- ✅ SessionManager cache (fallback)

### 2. Sponsor Name Resolution
After referral code captured, verify HTTP call:
```
🔍 Attempting HTTP fallback for sponsor lookup...
✅ NewRegistrationScreen: Referral data cached from fallback
```

### 3. Registration Flow Integration
Confirm sponsor name appears in UI:
- Registration form pre-populates sponsor field
- User sees: "Invited by: [Sponsor Name]"

## Test Commands

### Validate AASA File:
```bash
curl -s https://teambuildpro.com/.well-known/apple-app-site-association | jq .
```

### Check Branch Dashboard:
1. Login to Branch dashboard at https://dashboard.branch.io
2. Navigate to "Liveview" for real-time events
3. Navigate to "Link Analytics" for click tracking
4. Monitor these events in real-time:
   - **Click**: User tapped Branch link
   - **Install**: App installed from App Store
   - **Open**: App opened (immediate or deferred)
   - **Conversion**: User completed registration
5. Verify attribution chain: Click → Install → Open → Registration

### iOS Simulator Testing:
```bash
# Test Universal Link in simulator
xcrun simctl openurl booted "https://teambuildpro.com/?ref=88888888&t=1"
```

## Real Device Testing Requirements

**CRITICAL**: Deferred deep links do NOT work properly on iOS Simulator. Use physical devices for comprehensive testing.

### Required Test Devices:
- **iPhone** (iOS 14+ recommended)
- **iPad** (if supporting iPad)
- **Different iOS versions** (test iOS 14, 15, 16, 17)

### Device Setup:
1. **Clean Install**: Delete app if previously installed
2. **Fresh iCloud Account**: Use different Apple ID to avoid cache issues
3. **Network Connectivity**: Ensure stable internet during install/first open
4. **Location Services**: Enable if needed for attribution

### Device Testing Protocol:
1. **Step 1**: Clean device (delete app, clear Safari cache)
2. **Step 2**: Create test Branch link with unique referral code
3. **Step 3**: Tap link → App Store → Install → **Wait for complete install**
4. **Step 4**: **IMPORTANT**: Close App Store, go to Home Screen
5. **Step 5**: Tap app icon for first launch (not "Open" button)
6. **Step 6**: Monitor logs via Xcode Console for 30+ seconds
7. **Step 7**: Verify referral data appears in registration form

## Expected Debug Output Flow

### Successful Universal Link:
```
🔗 Deep Link: App launched with URI: https://teambuildpro.com/?ref=88888888&t=1
🔗 Deep Link: Processing URI: https://teambuildpro.com/?ref=88888888&t=1
🔍 widget.referralCode: 88888888
🔍 Using fresh constructor referral code: 88888888
🔍 Attempting HTTP fallback for sponsor lookup...
✅ NewRegistrationScreen: Referral data cached from fallback
```

### Successful Branch Deferred:
```
🌿 Branch: Deferred deep link captured: 88888888
🔍 Using cached referral data
Cached referral code: 88888888
Cached sponsor name: [Resolved Name]
```

## Troubleshooting

### Universal Links Not Working:
1. Verify AASA file accessibility
2. Check Associated Domains in Xcode
3. Confirm app ID matches AASA configuration

### Branch Not Attributing:
1. Verify Branch key configuration
2. Check internet connectivity during install
3. Monitor Branch real-time dashboard

### Referral Code Not Resolving:
1. Check HTTP endpoint accessibility
2. Verify sponsor exists in database
3. Monitor Firebase Functions logs

### Scenario 8: Smart App Banner Web-to-App Flow (iOS Safari)
**Setup:**
1. Ensure Smart App Banner meta tags are implemented on teambuildpro.com
2. Test with app installed and not installed states
3. Use referral URL: `https://teambuildpro.com/?ref=77777777&t=1`

**Test Steps:**
1. Open iOS Safari → Navigate to referral URL
2. Verify Smart App Banner appears at top of page
3. Tap "Open" button in banner
4. **Expected Result:** App opens with referral data preserved

**Logs to Capture:**
```
🔗 Deep Link: App launched via Smart App Banner
🔗 Deep Link: App argument: https://teambuildpro.com/?ref=77777777&t=1
🔍 Using fresh constructor referral code: 77777777
```

### Scenario 9: Enhanced Sponsor Overwrite Protection Test
**Setup:**
1. Open app with referral code A
2. Start filling registration form (enter first name)
3. Begin registration process (tap "Create Account")
4. New Branch link arrives with referral code B

**Test Steps:**
1. Open app: `teambuildpro.com/?ref=AAAAA&t=1`
2. Enter first name in registration form
3. Tap "Create Account" button (start registration)
4. Tap different link: `teambuildpro.app.link/xyz` (contains `ref=BBBBB`)
5. **Expected Result:** No overwrite dialog - registration process prevents changes

**Logs to Capture:**
```
🔍 REGISTER: Registration already started - preventing referral code overwrite
🔍 OVERWRITE AUDIT: Registration in progress, overwrite blocked
```

### Scenario 10: Referral Source Attribution Validation
**Setup:**
1. Test all three referral sources: constructor, branch, cache
2. Monitor Firestore for proper source tracking
3. Complete registration to verify data persistence

**Test Steps:**
1. **Constructor Source:** Open via Universal Link → Register
2. **Branch Source:** Install via Branch link → Register
3. **Cache Source:** Use cached data → Register
4. **Expected Result:** Each registration shows correct source in Firestore

**Logs to Capture:**
```
🔍 Using fresh constructor referral code: 88888888
🔍 REGISTER: Registration data prepared: {..., referralSource: constructor}
🔍 OVERWRITE AUDIT: User ACCEPTED referral code overwrite
```

### Scenario 11: Web-to-App Fallback Chain Test
**Setup:**
1. Test complete fallback chain: Smart Banner → Branch → App Store
2. Use iOS device with various app install states
3. Monitor each step of the attribution chain

**Test Steps:**
1. **App Installed:** Smart Banner → Direct app open
2. **App Not Installed:** Smart Banner → App Store → Branch attribution
3. **Smart Banner Disabled:** Branch link → App Store → Deferred attribution
4. **Expected Result:** Referral data preserved through entire chain

**Logs to Capture:**
```
🔗 Smart App Banner: Attempting app launch
🌿 Branch: Fallback attribution captured
🔗 Deep Link: App Store install attribution successful
```

## Enhanced Success Criteria
- ✅ Universal Links open app immediately with referral data
- ✅ App Store installs via Branch attribute deferred referral data
- ✅ Sponsor names resolve correctly via HTTP fallback
- ✅ Registration form pre-populates with sponsor information
- ✅ No false positives (generic installs show no referral data)
- ✅ Smart App Banner preserves referral data for installed users
- ✅ Sponsor overwrite protection prevents changes during registration
- ✅ Referral source attribution tracked accurately in Firestore
- ✅ Complete web-to-app fallback chain maintains attribution
- ✅ Enhanced UI shows clear "Invited by" sponsor information

## Additional Testing Requirements

### AASA File Validation
```bash
# Validate corrected AASA syntax with query parameters
curl -s https://teambuildpro.com/.well-known/apple-app-site-association | jq .
curl -s https://go.teambuildpro.com/.well-known/apple-app-site-association | jq .

# Test Universal Link routing with new syntax
xcrun simctl openurl booted "https://teambuildpro.com/?ref=88888888&t=1"
```

### Smart App Banner Validation
```bash
# Test Smart Banner meta tag presence
curl -s https://teambuildpro.com/?ref=88888888 | grep "apple-itunes-app"

# Expected output:
# <meta name="apple-itunes-app" content="app-id=6751211622, app-argument=https://teambuildpro.com/?ref=88888888&t=1">

# Test JavaScript dynamic update (open browser dev tools)
# Navigate to: https://teambuildpro.com/?ref=99999999&t=2
# Check console for: "🍎 Smart App Banner configured: https://teambuildpro.com/?ref=99999999&t=2"

# Test various URL patterns
curl -s https://teambuildpro.com/?new=AAAAA123&t=3 | grep "apple-itunes-app"
curl -s https://teambuildpro.com/ | grep "apple-itunes-app"  # Should show basic app-id only
```

### Fraud Prevention Testing
```bash
# Test self-referral detection (should be blocked)
# 1. Get user's own referral code
# 2. Attempt to register using own code
# 3. Verify registration proceeds without referral credit

# Test rapid registration detection
# 1. Attempt multiple registrations from same IP/device
# 2. Verify fraud flags are created after threshold
```

---
*Run this comprehensive test script before production deployment to ensure 100% referral tracking accuracy with enhanced fraud prevention.*