# Customer Support Guide: Referral System & "Invited by" UI

## Overview
This guide helps customer support representatives understand and troubleshoot Team Build Pro's referral tracking system, sponsor display, and overwrite protection features.

## Understanding the "Invited by" UI

### Normal Referral Display
When a user opens the app with a valid referral link, they'll see:

**Visual Elements:**
- Blue container with border and background
- Person icon next to sponsor name
- Text: "Invited by: [Sponsor Name]"
- In debug mode: referral code and source information

**Example:**
```
┌─────────────────────────────────────┐
│ 👤 Invited by: John Smith           │
│ Code: 88888888 (source: constructor)│
└─────────────────────────────────────┘
```

### No Referral Display
If no referral code is present:
- No "Invited by" container appears
- User proceeds with standard registration
- This is normal for direct app downloads

## Referral Sources & Attribution

### Source Types
1. **constructor** - Direct Universal Link click
2. **branch** - Branch SDK deferred attribution (App Store installs)
3. **cache** - Previously stored referral data

### Source Priority (Highest to Lowest)
1. Fresh Universal Link (constructor)
2. Branch deferred data
3. Cached referral data
4. No referral (admin registration)

## Referral Overwrite Protection System

### When Overwrite Dialogs Appear
**Trigger Conditions:**
- User has started entering form data (any field)
- New referral code arrives (different from current)
- Registration process has NOT started yet

**Dialog Content:**
```
New Referral Code Detected

A new referral code has been detected:
New code: 99999999
Source: branch

Current code: 88888888
Current source: constructor

Would you like to update your referral code?

[Keep Current] [Use New Code]
```

### When Overwrite is BLOCKED
**Protection Triggers:**
- User has tapped "Create Account" button
- Registration process has begun
- Firebase user creation is in progress

**User Experience:**
- No dialog appears
- New referral code is silently ignored
- Original referral data preserved

## Common Support Scenarios

### Scenario 1: "I don't see my sponsor's name"
**Possible Causes:**
1. **Invalid referral code** - Check if code exists in system
2. **Network issue** - Sponsor name resolution failed
3. **Generic download** - User downloaded without referral link

**Troubleshooting Steps:**
1. Ask user how they downloaded the app
2. Check if they used a referral link
3. Verify sponsor exists: lookup referral code in admin panel
4. If sponsor exists but name missing: network resolution issue

**Resolution:**
- If valid sponsor: user can manually enter sponsor information
- If invalid: proceed with standard registration

### Scenario 2: "Wrong sponsor is showing"
**Possible Causes:**
1. **Multiple referral links** - User clicked different links
2. **Cached data** - Old referral data from previous session
3. **Shared device** - Previous user's referral data

**Troubleshooting Steps:**
1. Ask if user clicked multiple invite links
2. Check if device was used by someone else
3. Verify which sponsor they intended to register under

**Resolution:**
- User can decline overwrite to keep intended sponsor
- Or accept overwrite if new sponsor is correct
- Clear app data if persistent cache issues

### Scenario 3: "Overwrite dialog keeps appearing"
**Possible Causes:**
1. **Multiple active links** - User has multiple referral URLs open
2. **Branch attribution delay** - Deferred data arriving late
3. **Network connectivity** - Intermittent connection causing retries

**Troubleshooting Steps:**
1. Ask user to close all other browser tabs/links
2. Ensure stable internet connection
3. Complete registration quickly after choosing

**Resolution:**
- Choose one sponsor and proceed immediately
- If dialog persists: restart app and use single referral link

### Scenario 4: "I can't change my sponsor"
**Possible Causes:**
1. **Registration started** - Protection system activated
2. **Account already created** - Too late to change
3. **Admin registration** - No referral system for admins

**Troubleshooting Steps:**
1. Check if user tapped "Create Account" already
2. Verify if Firebase account was created
3. Confirm user role (admin vs regular user)

**Resolution:**
- If registration started: cannot change (by design)
- If account created: requires admin intervention
- If admin: no sponsor assignment needed

## Debug Information for Support

### Log Patterns to Look For
**Successful Referral Capture:**
```
🔍 Using fresh constructor referral code: 88888888
✅ NewRegistrationScreen: Referral data cached
```

**Overwrite Dialog Triggered:**
```
🔍 OVERWRITE DIALOG: Showing referral code overwrite dialog
🔍 OVERWRITE DIALOG: Current code: 88888888 (source: constructor)
🔍 OVERWRITE DIALOG: New code: 99999999 (source: branch)
```

**Overwrite Decision Audit:**
```
🔍 OVERWRITE AUDIT: User ACCEPTED referral code overwrite
🔍 OVERWRITE AUDIT: Changed from 88888888 (constructor) to 99999999 (branch)
```

**Protection System Activated:**
```
🔍 REGISTER: Registration already started - preventing referral code overwrite
```

### User Data Verification
**Check in Firestore:**
```
users/{userId}
├── referralSource: "constructor|branch|cache"
├── referralCodeUsed: "88888888"
├── sponsorId: "sponsor-firebase-uid"
└── registrationTimestamp: [timestamp]
```

**Audit Trail:**
```
referralAudits/{auditId}
├── action: "referral_overwrite"
├── oldReferralCode: "88888888"
├── newReferralCode: "99999999"
├── userDecision: "accepted|rejected"
└── timestamp: [timestamp]
```

## Escalation Guidelines

### Tier 1 Support Can Handle:
- Explaining referral system behavior
- Troubleshooting common display issues
- Verifying sponsor information
- Guiding through overwrite decisions

### Escalate to Tier 2 When:
- Suspected fraud (self-referral attempts)
- Technical issues with attribution
- Firestore data inconsistencies
- Mass complaints about same sponsor

### Escalate to Engineering When:
- Branch SDK attribution failures
- Universal Link routing issues
- System-wide referral tracking problems
- AASA file accessibility issues

## Quick Reference Commands

### Verify Sponsor Exists
```
Search referralCodes collection for code: "88888888"
Expected result: Firebase UID of sponsor
```

### Check User's Referral Data
```
Look up users/{userId}:
- referralSource: shows attribution method
- referralCodeUsed: shows actual code used
- sponsorId: shows resolved sponsor UID
```

### Validate Attribution Chain
```
Check referralAudits for userId:
- Shows all referral code changes
- Includes user decisions (accept/reject)
- Provides timestamp trail
```

## FAQ Responses

**Q: Why does the sponsor name take a few seconds to appear?**
A: The app resolves sponsor names via network lookup for accuracy. The referral code appears immediately, but the name requires a brief server call.

**Q: Can I change my sponsor after registration?**
A: No, sponsor assignments are permanent once registration completes. This ensures proper credit attribution and prevents gaming the system.

**Q: What if I accidentally chose the wrong sponsor?**
A: If you haven't completed registration yet, you may see an overwrite dialog if another referral link is available. Once registration starts, the choice becomes final.

**Q: Why am I seeing a referral code but no sponsor name?**
A: This indicates a network issue during sponsor name lookup. The referral is still valid - the system will retry resolving the name.

**Q: Can someone else's referral data appear on my device?**
A: Only if the device was previously used with a different referral link. Clear the app data or use a fresh install to reset.

---

**Support Tip:** When in doubt, check the app logs for emoji-tagged debug messages. They provide clear insight into what the referral system is doing and why.