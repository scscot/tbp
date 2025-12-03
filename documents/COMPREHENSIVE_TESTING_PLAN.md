# Comprehensive Testing Plan: Localization Phase 1B

**Status**: PR#4 Complete - Ready for Testing
**Date**: 2025-11-08
**Tag**: `localization-phase1b-pr4-complete`

---

## Testing Overview

This plan covers comprehensive testing of all localization work completed in Phase 1B across three PRs:

- **PR#1**: Core l10n infrastructure (key-sync, pseudo-localization, 5 validation checks)
- **PR#3**: Recruiting messages + analytics locale fix + key-sync automation
- **PR#4**: Notification + empty state extraction (28 new keys)

**Total Scope**: 126 localization keys across 4 locales (en, es, pt, tl)

---

## I. Pre-Testing Setup

### A. Environment Verification

```bash
# 1. Verify Flutter version matches CI
flutter --version
# Expected: Flutter 3.35.7 or later

# 2. Verify all dependencies installed
flutter pub get
cd locales && npm ci && cd ..

# 3. Verify tests pass
flutter test
# Expected: 126 tests passing

# 4. Verify analyzer passes
flutter analyze --no-fatal-warnings
# Expected: 4 deprecation warnings (dropdown issue #18), no other issues

# 5. Verify localization tools work
cd locales
npm run check
# Expected: All checks pass (parity, ICU, concat, buttons, lengths)
```

### B. Test Data Preparation

**Create test accounts with diverse data**:
- User with 0 team members (empty states)
- User with 4 direct sponsors (milestone threshold)
- User with 20+ total team (milestone threshold)
- User with Spanish locale (`es`)
- User with Portuguese locale (`pt`)
- User with Tagalog locale (`tl`)
- User with active subscription
- User with expired subscription

---

## II. Automated Testing

### A. Unit Tests (Already Passing)

```bash
flutter test
```

**Coverage**: 126 tests across 4 test suites
- ✓ 32 notification message tests (8 per locale)
- ✓ 32 empty state tests (8 per locale)
- ✓ 30 recruiting message tests
- ✓ 32 core l10n tests

**Verify**:
- All ICU placeholders resolved correctly
- Plural forms work (one/other cases)
- No unresolved `{placeholder}` strings in output
- Character caps enforced for push notifications

### B. Localization Validation

```bash
cd locales
npm run check:parity     # Key parity across all locales
npm run check:icu        # ICU MessageFormat syntax
npm run check:concat     # No forbidden string concatenation
npm run check:buttons    # Button length limits
npm run check:lengths    # Message length caps
```

**Expected**: All checks pass with 0 errors

### C. Raw String Scanning

```bash
cd locales
# Scan all UI files (should only fail on allowlisted legacy violations)
node generators/check_raw_strings.js

# Generate fresh allowlist to verify no new violations
node generators/check_raw_strings.js --generate-allowlist > /tmp/new_allowlist.json
diff allowlists/raw_strings_allowlist.json /tmp/new_allowlist.json
# Expected: No differences (no new violations introduced)
```

---

## III. Manual UI Testing

### A. Locale Switching

**Test Steps**:
1. Launch app in English (default)
2. Navigate to Settings → Language
3. Switch to Spanish (es)
4. Verify all UI text updates immediately
5. Switch to Portuguese (pt)
6. Verify all UI text updates immediately
7. Switch to Tagalog (tl)
8. Verify all UI text updates immediately
9. Switch back to English
10. Force quit and relaunch app
11. Verify locale persists

**Verification Points**:
- [ ] All screens update without requiring app restart
- [ ] No mixed-language text (English + Spanish)
- [ ] No placeholder keys visible (e.g., `{key}` or `{{key}}`)
- [ ] Locale preference persists across app restarts
- [ ] Analytics events log correct locale (analytics_locale fix)

### B. Empty State Messages (PR#4)

**Test empty states in each locale (en, es, pt, tl)**:

1. **Empty Network** (`emptyNetworkTitle`, `emptyNetworkMessage`)
   - View network page with 0 team members
   - Verify title and message display correctly
   - Verify "Start Building" CTA button text

2. **Empty Messages** (`emptyMessagesTitle`, `emptyMessagesMessage`)
   - View messages page with 0 conversations
   - Verify title and message display correctly
   - Verify action button text

3. **Empty Search Results** (`emptySearchTitle`, `emptySearchMessage`)
   - Search for non-existent team member
   - Verify title and message display correctly

4. **No Subscription** (`errorNoSubTitle`, `errorNoSubMessage`)
   - Attempt premium action without subscription
   - Verify error dialog title and message

5. **Network Error** (`errorNetworkTitle`, `errorNetworkMessage`)
   - Trigger network error (airplane mode)
   - Verify error dialog title and message

**Verification Points**:
- [ ] All empty states display in correct locale
- [ ] No English fallback in non-English locales
- [ ] Message tone appropriate (encouraging, not negative)
- [ ] CTA buttons have localized text

### C. Push Notifications (PR#4 - Server-Side)

**Test notification delivery in each locale**:

**Setup**:
1. Deploy Firebase Functions with new notification locales
2. Configure user's `primaryLanguage` field in Firestore
3. Trigger notifications via Cloud Functions

**Test Cases**:

1. **Milestone: Direct Sponsors** (`notifMilestoneDirectTitle/Body`)
   ```
   User reaches 4 direct sponsors
   Expected: Push notification with correct locale
   Placeholders: {firstName}, {directCount}, {remaining}, {bizName}
   Plural: "member" vs "members"
   ```
   - [ ] English notification received
   - [ ] Spanish notification received
   - [ ] Portuguese notification received
   - [ ] Tagalog notification received
   - [ ] Title ≤65 chars
   - [ ] Body ≤140 chars
   - [ ] Plural forms correct (1 member vs 2 members)

2. **Milestone: Total Team** (`notifMilestoneTeamTitle/Body`)
   ```
   User reaches 20 total team members
   Expected: Push notification with correct locale
   Placeholders: {firstName}, {teamCount}, {remaining}, {bizName}
   Plural: "sponsor" vs "sponsors"
   ```
   - [ ] All 4 locales delivered correctly
   - [ ] Character caps enforced
   - [ ] Plural forms correct

3. **Subscription: Active** (`notifSubActiveTitle/Body`)
   ```
   User activates subscription
   Placeholder: {expiryDate}
   ```
   - [ ] All 4 locales delivered correctly
   - [ ] Date formatted per locale

4. **Subscription: Cancelled** (`notifSubCancelledTitle/Body`)
   - [ ] All 4 locales delivered correctly

5. **Subscription: Expired** (`notifSubExpiredTitle/Body`)
   - [ ] All 4 locales delivered correctly

6. **Subscription: Expiring Soon** (`notifSubExpiringSoonTitle/Body`)
   - [ ] All 4 locales delivered correctly
   - [ ] Date formatted per locale

7. **Subscription: Paused** (`notifSubPausedTitle/Body`)
   - [ ] All 4 locales delivered correctly

8. **Subscription: Payment Issue** (`notifSubPaymentIssueTitle/Body`)
   - [ ] All 4 locales delivered correctly

9. **New Message** (`notifNewMessageTitle`)
   ```
   User receives chat message
   Placeholder: {senderName}
   ```
   - [ ] All 4 locales delivered correctly

10. **Team Activity** (`notifTeamActivityTitle/Body`)
    ```
    Team member visits business opportunity page
    Placeholder: {visitorName}
    ```
    - [ ] All 4 locales delivered correctly

11. **Launch Campaign Sent** (`notifLaunchSentTitle/Body`)
    - [ ] All 4 locales delivered correctly

**Verification Method**:
```javascript
// In Firebase Functions console, check logs
firebase functions:log | grep "PUSH MILESTONE"
firebase functions:log | grep "NOTIFICATION_CREATED"

// Verify locale resolution logic
// functions/locales/notifications/{locale}.json loaded correctly
```

### D. Recruiting Messages (PR#3)

**Test invitation templates in each locale**:

1. **Default Invitation** (`inviteMessageDefaultSubject`, `inviteMessageDefaultBody`)
   - Send invitation from app
   - Verify subject line in correct locale
   - Verify body text in correct locale
   - Verify placeholders replaced: `{senderName}`, `{bizName}`, `{inviteLink}`

2. **Launch Campaign** (`inviteMessageLaunchSubject`, `inviteMessageLaunchBody`)
   - Trigger launch campaign
   - Verify all recipients get localized messages
   - Verify placeholder replacement

3. **Custom Templates** (`inviteMessageCustomPlaceholder`)
   - Create custom template with placeholders
   - Send to network
   - Verify correct substitution

**Test in all 4 locales**: en, es, pt, tl

**Verification Points**:
- [ ] Subject lines ≤50 chars
- [ ] Body text readable and professional
- [ ] No placeholder keys visible (`{key}`)
- [ ] Links work correctly
- [ ] Sender name displays correctly

### E. Analytics Locale Fix (PR#3)

**Test analytics locale reporting**:

1. Set device locale to Spanish (es)
2. Generate analytics events (screen views, button taps)
3. Check Firebase Analytics console
4. Verify `analytics_locale` property = "es"

**Repeat for**:
- Portuguese (pt)
- Tagalog (tl)
- English (en)

**Before Fix**: Would show "es_US" (mixed locale)
**After Fix**: Shows "es" (correct ISO 639-1)

**Verification**:
```dart
// In code: lib/services/analytics_service.dart
final locale = Localizations.localeOf(context).languageCode; // Should be 'es', not 'es_US'
```

---

## IV. Edge Cases & Error Handling

### A. Missing Translations (Fallback Behavior)

**Scenario**: Key exists in en.arb but missing in es.arb

**Expected Behavior**:
- App should display English fallback
- No crash or blank text
- Log warning in debug mode

**Test**:
1. Temporarily remove a key from app_es.arb
2. Switch to Spanish locale
3. Navigate to screen using that key
4. Verify English text displays (fallback)
5. Restore key

### B. ICU Syntax Errors

**Scenario**: Malformed ICU placeholder in ARB file

**Protected By**:
- `npm run check:icu` in CI (pre-merge validation)
- Flutter localizations generator (compile-time validation)

**Test**:
1. Introduce syntax error in app_en.arb
2. Run `flutter gen-l10n`
3. Verify build fails with clear error message

### C. Character Cap Violations (Push Notifications)

**Scenario**: Notification title/body exceeds push limits

**Protected By**:
- `npm run check:lengths` validates ARB metadata caps
- Server-side truncation in Cloud Functions (if needed)

**Test**:
1. Add extra text to `notifMilestoneDirectTitle` to exceed 65 chars
2. Run `npm run check:lengths`
3. Verify validation fails with clear error

### D. Unsupported Locale

**Scenario**: User's device set to unsupported locale (e.g., French)

**Expected Behavior**:
- App falls back to English (default)
- No crash

**Test**:
1. Change device locale to French (fr)
2. Launch app
3. Verify English text displays
4. Verify no errors in logs

### E. Concurrent Locale Switches

**Scenario**: Rapidly switch between locales

**Test**:
1. Navigate to Settings → Language
2. Quickly switch: en → es → pt → tl → en
3. Verify no crashes
4. Verify final locale persists
5. Navigate through app
6. Verify all text in correct locale

---

## V. Performance Testing

### A. App Launch Time (Locale Loading)

**Baseline**: App launch time before localization
**Expected**: Negligible impact (<50ms difference)

**Test**:
1. Clear app cache
2. Force quit app
3. Launch app with stopwatch
4. Measure time to first screen
5. Repeat for each locale (en, es, pt, tl)

**Acceptance**: Launch time within 5% of baseline

### B. Memory Usage (Multiple Locales)

**Test**:
1. Launch app
2. Switch between all 4 locales 10 times
3. Monitor memory usage (Xcode Instruments / Android Profiler)
4. Verify no memory leaks

**Acceptance**: Memory usage stable, no continuous growth

### C. Locale Switch Responsiveness

**Test**:
1. Switch locale in Settings
2. Immediately navigate to complex screen (Network view)
3. Verify text updates within 100ms
4. No UI flicker or blank states

---

## VI. Server-Side Testing (Cloud Functions)

### A. Notification Locale Resolution

**Test Functions**:
- `createNotificationWithPush()` - Uses user's `primaryLanguage`
- `notifyOnMilestoneReached()` - Loads correct locale file

**Test Steps**:
1. Set user's `primaryLanguage` in Firestore to "es"
2. Trigger milestone notification
3. Check function logs:
   ```bash
   firebase functions:log | grep "NOTIFICATION_CREATED"
   ```
4. Verify Spanish notification locale used
5. Repeat for pt, tl, en

**Verification**:
```javascript
// In functions/index.js
const userLocale = userData.primaryLanguage || 'en';
const localeStrings = require(`./locales/notifications/${userLocale}.json`);
```

### B. Locale File Loading

**Test**:
1. Deploy functions with locale files
2. Trigger notification
3. Verify locale files load correctly:
   ```bash
   firebase functions:log | grep "Loading notification locale"
   ```
4. Verify fallback to English if locale file missing

### C. FCM Token Resolution + Locale

**Test**:
- User with FCM token + Spanish locale
- Milestone triggered
- Verify push notification delivered in Spanish

**Check Logs**:
```bash
firebase functions:log | grep "PUSH MILESTONE"
```

---

## VII. Regression Testing

### A. Existing Features Still Work

**Verify no breakage in**:
- [ ] User authentication (Google, Apple, Email)
- [ ] Network view (team hierarchy)
- [ ] Messaging (chat functionality)
- [ ] Subscription management
- [ ] Profile updates
- [ ] Invitation sending
- [ ] Analytics tracking
- [ ] Push notifications (delivery)

### B. Database Schema Unchanged

**Verify**:
- No changes to Firestore collections/documents
- No changes to user profile fields (except `primaryLanguage` usage)
- Existing queries still work

### C. Third-Party Integrations

**Verify**:
- Firebase Analytics still tracking events
- FCM push notifications still delivering
- Cloud Functions still executing
- Remote Config still loading
- App Store Server-to-Server notifications still working

---

## VIII. Test Execution Checklist

### Phase 1: Automated Tests (10 minutes)
- [ ] Run `flutter test` (126 tests pass)
- [ ] Run `flutter analyze --no-fatal-warnings` (4 expected warnings)
- [ ] Run `npm run check` in locales/ (all validations pass)
- [ ] Run raw string scanner (no new violations)

### Phase 2: Manual UI Tests (30 minutes)
- [ ] Test locale switching (all 4 locales)
- [ ] Test empty states (5 states × 4 locales = 20 tests)
- [ ] Test recruiting messages (3 templates × 4 locales = 12 tests)
- [ ] Test analytics locale fix (4 locales)

### Phase 3: Push Notification Tests (45 minutes)
- [ ] Deploy Cloud Functions with notification locales
- [ ] Test 11 notification types × 4 locales = 44 tests
- [ ] Verify character caps enforced
- [ ] Verify plural forms correct

### Phase 4: Edge Cases (20 minutes)
- [ ] Missing translation fallback
- [ ] Unsupported locale fallback
- [ ] Rapid locale switching
- [ ] Malformed ICU syntax (protected by CI)

### Phase 5: Performance (15 minutes)
- [ ] App launch time in each locale
- [ ] Memory usage during locale switches
- [ ] UI responsiveness on locale change

### Phase 6: Regression Testing (30 minutes)
- [ ] Existing features still functional
- [ ] No database schema changes
- [ ] Third-party integrations working

**Total Estimated Time**: 2.5 hours

---

## IX. Success Criteria

### Must Pass (Blockers)
1. ✅ All 126 automated tests pass
2. ✅ All localization validation checks pass (parity, ICU, concat, buttons, lengths)
3. ✅ No new raw string violations introduced
4. ✅ All empty states display correctly in 4 locales
5. ✅ Locale switching works without crashes
6. ✅ Push notifications delivered in correct locale
7. ✅ No regression in existing features

### Should Pass (High Priority)
1. Analytics locale fix verified (correct ISO 639-1 codes)
2. Recruiting messages work in 4 locales
3. Character caps enforced for push notifications
4. Plural forms work correctly
5. Performance within 5% of baseline

### Nice to Have (Medium Priority)
1. Memory usage stable across locale switches
2. UI updates within 100ms on locale change
3. Comprehensive logs for debugging

---

## X. Test Reporting

### A. Test Results Document

Create `documents/TEST_RESULTS.md` with:
- Date/time of testing
- Device/emulator used
- Flutter version
- Pass/fail for each test case
- Screenshots of critical UI states
- Performance metrics
- Issues discovered

### B. Issue Tracking

For any failures:
1. Create GitHub issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/logs
   - Severity (blocker/high/medium/low)
2. Link issue to test case in results doc

### C. Sign-Off

**Testing Complete When**:
- All "Must Pass" criteria met
- All "Should Pass" criteria met (or issues created)
- Test results documented
- No blocker issues remaining

**Approver**: Stephen Scott
**Date**: ___________
**Signature**: ___________

---

## XI. Known Issues (Pre-Testing)

1. **Issue #18**: 4 dropdown deprecation warnings (non-blocking)
   - Affects: `lib/screens/admin_edit_profile_screen.dart`, `lib/screens/update_profile_screen.dart`
   - Impact: Analyzer warnings only, no runtime impact
   - Resolution: Tracked in issue #18, separate PR planned

2. **218 legacy raw string violations** (grandfathered)
   - Affects: 35 files across lib/screens/ and lib/widgets/
   - Impact: None (allowlisted in CI)
   - Resolution: Burn down gradually in future PRs

---

## XII. Post-Testing Actions

### If All Tests Pass:
1. Tag release: `git tag localization-phase1b-tested`
2. Update CHANGELOG.md
3. Prepare for App Store submission (if applicable)
4. Schedule dropdown refactor PR (issue #18)
5. Plan Phase 2: Additional locales (if applicable)

### If Critical Issues Found:
1. Create blocker issues in GitHub
2. Prioritize fixes
3. Re-run affected test suites after fixes
4. Delay release until blockers resolved

---

**Document Version**: 1.0
**Last Updated**: 2025-11-08
**Owned By**: Claude Code + Stephen Scott
**Related Tags**: `localization-phase1b-pr4-complete`
