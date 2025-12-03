# iOS mailto: Line Breaks Issue

## Executive Summary

The Share Screen's email functionality does not render line breaks correctly on iOS devices. This is due to a known iOS platform limitation with the `mailto:` URL scheme, not a bug in our code.

## Issue Description

**Problem**: When users select the "Email" option from the Share dialog, the message body displays as a single paragraph without line breaks in the iOS Mail app.

**Affected Feature**: Share Screen → Email option
**Platform**: iOS only (Android/web behavior unknown)
**User Impact**: Email messages are harder to read due to missing paragraph breaks

**Current Behavior**:
```
Subject: Join My Team!Hi there!I wanted to share this amazing opportunity...
```

**Expected Behavior**:
```
Subject: Join My Team!

Hi there!

I wanted to share this amazing opportunity...
```

## Root Cause Analysis

### Technical Investigation

Extensive research reveals this is an **iOS platform bug**, not an application code issue:

1. **iOS Version History**:
   - **iOS 13 and earlier**: Line breaks in mailto: URLs worked correctly
   - **iOS 14.6 - 14.7**: Apple removed line break support for security reasons (confirmed bug)
   - **iOS 15+**: Allegedly fixed, but results remain inconsistent across devices

2. **Apple Bug Reports**:
   - Bug report FB9146675 filed with Apple
   - Multiple Stack Overflow questions documenting the issue
   - Apple Developer Forums discussions confirming platform limitation

3. **Technical Specifications**:
   - RFC2368 (mailto: URL spec) requires `%0D%0A` encoding for line breaks
   - iOS Mail app does not honor this encoding since iOS 14.6
   - No HTML support in mailto: URLs (removed for security)

### Research Sources

- Stack Overflow: "Flutter url_launcher line break doesn't work in iOS mail program"
- Apple Developer Forums: "Mailto url encoding issue iOS 14.6"
- Multiple GitHub issues on Flutter and React Native projects
- RFC2368 mailto: URL specification

### Code Attempts Made

We attempted the following encoding methods, all unsuccessful:

1. **Standard CRLF encoding** (`%0D%0A`)
   ```dart
   body.replaceAll('\n', '%0D%0A')
   ```

2. **HTML line breaks** (`<br>`)
   ```dart
   body.replaceAll('\n', '<br>')
   ```
   Result: Literal `<br>` text displayed in email

3. **Uri.encodeComponent()** with various encodings
   ```dart
   final encodedBody = Uri.encodeComponent(body);
   ```

4. **Uri constructor with queryParameters** (current implementation)
   ```dart
   Uri(scheme: 'mailto', query: Uri(queryParameters: {'body': body}).query)
   ```

**Conclusion**: None of these methods work due to iOS Mail app limitations.

## Current Workaround Status

**Text Message Option**: ✅ Works correctly with line breaks
- Uses `sms:` URL scheme
- Line breaks render properly
- User feedback confirms functionality

**Email Option**: ❌ Line breaks do not render
- Uses `mailto:` URL scheme
- iOS platform limitation
- No reliable code-based solution exists

## Proposed Solutions

### Option 1: Accept Limitation + User Education (Recommended)

**Description**: Document the limitation and educate users on the best option to use.

**Implementation**:
- No code changes required
- Add note to user documentation/help section
- Train support team on the limitation

**Pros**:
- No development time required
- Honest about platform limitation
- Text message option works perfectly

**Cons**:
- Email messages less readable
- May cause user confusion initially

**Cost**: $0, 0 hours development

---

### Option 2: Add Warning Dialog for Email Option

**Description**: Show a brief notice when users select "Email" informing them about the formatting limitation.

**Implementation**:
```dart
// When user taps "Email" button
showDialog(
  context: context,
  builder: (context) => AlertDialog(
    title: Text('Email Formatting Note'),
    content: Text(
      'Due to iOS limitations, line breaks may not display in emails. '
      'For better formatting, consider using Text Message instead.'
    ),
    actions: [
      TextButton(
        child: Text('Use Text Message'),
        onPressed: () { /* Switch to SMS */ },
      ),
      TextButton(
        child: Text('Continue with Email'),
        onPressed: () { /* Proceed with email */ },
      ),
    ],
  ),
);
```

**Pros**:
- Users make informed choice
- Reduces confusion
- Minimal development effort

**Cons**:
- Extra step in user flow
- May feel like over-warning
- Still doesn't fix the core issue

**Cost**: 2-4 hours development + testing

---

### Option 3: Set Text Message as Default/Preferred Option

**Description**: Reorder the dialog to show "Text Message" first, making it the natural choice.

**Implementation**:
```dart
// In _showShareMethodDialog, reorder buttons:
actions: [
  TextButton.icon(
    icon: Icon(Icons.message),
    label: Text('Text Message'),  // Now first
    onPressed: () => _composeSMS(...),
  ),
  TextButton.icon(
    icon: Icon(Icons.email),
    label: Text('Email'),  // Now second
    onPressed: () => _composeEmail(...),
  ),
],
```

**Pros**:
- Subtle nudge toward working option
- No warning dialogs
- Very simple implementation

**Cons**:
- Doesn't solve email issue
- Some users prefer email regardless

**Cost**: 0.5 hours (already can be done)

---

### Option 4: Use Alternative Email Composition Method

**Description**: Instead of mailto: URL, use platform-specific email composition APIs.

**Implementation**:
- Research and integrate packages like `flutter_email_sender` or `share_plus` with email
- Use native iOS MFMailComposeViewController
- Requires platform channel or package

**Pros**:
- Native email composer supports rich formatting
- Full control over email composition
- Better user experience

**Cons**:
- Significant development effort
- Requires testing on multiple iOS versions
- May require additional permissions
- Package maintenance risk

**Cost**: 16-24 hours development + testing
**Risk**: Medium (package dependencies, platform compatibility)

---

### Option 5: Replace Email with Share Sheet

**Description**: Use iOS native share sheet instead of mailto: URL.

**Implementation**:
```dart
import 'package:share_plus/share_plus.dart';

Future<void> _shareViaSystem(String subject, String body) async {
  final text = '$subject\n\n$body';
  await Share.share(
    text,
    subject: subject,
  );
}
```

**Pros**:
- iOS share sheet preserves formatting
- Users can choose their preferred app (Mail, Messages, WhatsApp, etc.)
- One solution works for all sharing methods
- share_plus already in pubspec.yaml (v7.2.2)

**Cons**:
- Different UX pattern (system sheet vs our dialog)
- Less control over which app opens
- May confuse users who expect email/SMS choice

**Cost**: 4-8 hours development + testing

---

## Recommendation Matrix

| Solution | Development Cost | User Impact | Solves Problem | Risk |
|----------|-----------------|-------------|----------------|------|
| Option 1: Accept + Document | None | Low | No | None |
| Option 2: Warning Dialog | 2-4 hours | Medium | No | Low |
| Option 3: Reorder Buttons | 0.5 hours | Low | Partially | None |
| Option 4: Native Email API | 16-24 hours | High | Yes | Medium |
| Option 5: Share Sheet | 4-8 hours | Medium | Yes | Low |

## Final Recommendation

**Recommended Approach**: Combination of **Option 3 + Option 1**

1. **Immediate**: Reorder dialog buttons to show "Text Message" first (0.5 hours)
2. **Short-term**: Document the limitation in user help/FAQ (1 hour)
3. **Future consideration**: If user feedback demands, implement Option 5 (Share Sheet)

**Rationale**:
- Text message option works perfectly and meets user needs
- Low development cost and risk
- Honest about platform limitations
- Can be enhanced later if needed

## Technical Details for Reference

### Current Implementation
```dart
// lib/screens/share_screen.dart:165-194

Future<void> _composeEmail({
  required String subject,
  required String body,
}) async {
  final uri = Uri(
    scheme: 'mailto',
    query: Uri(queryParameters: {
      'subject': subject,
      'body': body,
    }).query,
  );

  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
```

### SMS Implementation (Working)
```dart
// lib/screens/share_screen.dart:211-253

Future<void> _composeSMS({
  required String subject,
  required String body,
}) async {
  final messageBody = '$subject\n\n$body';
  final uri = Uri.parse('sms:?&body=${Uri.encodeComponent(messageBody)}');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
```

### iOS Version Context

According to research, the issue timeline:
- First appeared: iOS 14.6 (June 2021)
- Apple's stated reason: Security enhancement
- Current status: Unfixed in iOS 18 (as of 2024)
- No official Apple documentation on workaround

## Questions for Decision Maker

1. How important is email formatting to the user experience vs SMS?
2. What percentage of users prefer email over text message?
3. Are users sharing primarily to mobile devices (where SMS works) vs desktop?
4. What is the acceptable development budget for this fix?
5. Is this a blocker for App Store submission?

## Appendix: Research Links

- https://stackoverflow.com/questions/67859136/flutter-url-launcher-line-break-doesnt-work-in-ios-mail-program
- https://stackoverflow.com/questions/65771599/how-to-insert-a-line-break-in-the-body-of-mailto-on-ios
- https://developer.apple.com/forums/thread/681023
- RFC2368: The mailto URL scheme

---

**Document Created**: 2025-11-13
**Platform**: iOS (iPhone 16, iOS 18.x)
**Flutter Version**: 3.3.0+
**Affected File**: lib/screens/share_screen.dart
**Current Status**: Awaiting decision on solution approach
