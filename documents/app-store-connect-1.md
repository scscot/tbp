App Store Connect Review Submission

Your task is to review this information below and the attached files and then create a definitive fix that will ensure the identified bug “Bug description: an error message is displayed when attempting to Sign in with Apple” is resolved. Apple has rejected my app build 3x for the same reason, and past efforts to fix have been unsuccessful.

I already have the exact simulator the reviewer used booted up in Xcode:
xcrun simctl openurl 0847A5C8-D11F-48FB-B569-C97385723D6D "teambuildpro://?new=lucinda9336"

Please view the video of what I believe (but cannot confirm) is the ‘bug’ the reviewer is experiencing when using the ’Sign up with Apple’. When the user clicks on the ‘Sign up with Apple’ app, no error occurs however, if the user then clicks ‘close’ the red snackbar is displayed at the bottom of the screen momentarily. Perhaps that, the error the reviewer is flagging, but again, I cannot be certain. I am attaching a screenshot of of this and I also want you to view the video of this behavior at https://share.icloud.com/photos/05d9RDwHUzJV_VUoBQWO8AD-g

Can you launch the xcrun simctl openurl 0847A5C8-D11F-48FB-B569-C97385723D6D "teambuildpro://?new=lucinda9336" and test this behavior for yourself to identify how to fix .. meaning prevent the red warning snackbar from appearing at the bottom of the screen when the ‘close’ button is clicked?

Here are the latest Review Notes provided with previous App Store Connect build submission that was rejected:

App Store Connect Reviewer Notes - Team Build Pro v1.0.16

Issue Resolution: Apple Sign-In Authentication Error

Problem Identified
The previous build (v1.0.15) was rejected due to an Apple Sign-In authentication error occurring on iPad Air (5th generation) running iPadOS 26.0. The reviewer encountered the error: "An error occurred when we tried to login using Apple."

Root Cause Analysis
Upon investigation, we identified that the Apple Sign-In implementation incorrectly included `webAuthenticationOptions` for iOS/iPadOS, which forced a web-based authentication flow instead of the native iOS flow. This caused authentication failures on iPad devices, as the web flow requires a properly configured Service ID that wasn't being used correctly.

Solution Implemented
1. Native iOS Authentication Flow
- Removed `webAuthenticationOptions` from iOS/iPadOS Apple Sign-In calls
- Implemented proper platform detection using `kIsWeb` to separate web and native flows
- Native iOS flow now uses the correct App ID configuration without web parameters

2. Enhanced Token Validation
- Added explicit null checks for `identityToken` and `authorizationCode`
- Improved error handling with clear user feedback for authentication failures
- Added Apple Sign-In availability verification before authentication attempts

3. Proper Web Flow Gating
- Web authentication now uses the correct Service ID (`com.scott.ultimatefix.auth`)
- Web flow only activated when `kIsWeb` is true, preserving native experience on iOS/iPadOS

4. Improved Button Labels for Review Experience
- Updated button text from "Sign up with Apple" to "Sign in with Apple" following Apple's design guidelines
- This clarifies that the button works for both new and returning users, reducing potential reviewer confusion
- Matches industry standard implementation that reviewers expect to see

Testing Verification
The fixes address the specific technical and user experience issues that caused the authentication failure:
- Apple Sign-In now uses the correct native iOS flow without problematic web authentication
- Button labels follow Apple's design guidelines to reduce reviewer confusion
- Implementation passes Flutter analyzer with no warnings or errors
- Ready for testing on iPad Air (5th generation) and iPadOS 26.0 environment

Additional Information
- All other authentication methods (Google Sign-In, Email/Password) remain fully functional
- The app maintains compliance with all App Store guidelines
- No changes were made to core app functionality or user experience

We appreciate your thorough review and apologize for the inconvenience. The Apple Sign-In functionality should now work correctly across all iOS devices and versions in the production environment.

---
Team Build Pro Development Team  
Submission Date: September 2025

REVIEWERS RESPONSE - REJECTED

App Review
2025-09-15 4:07 PM
Hello,

The issues we previously identified still need your attention.

If you have any questions, we are here to help. Reply to this message in App Store Connect and let us know.

Review Environment

Submission ID: 63edf9c8-0a8a-49d7-b6ac-9da25431e320
Review date: September 15, 2025
Version reviewed: 1.0.16

Guideline 2.1 - Performance - App Completeness
Issue Description

The app exhibited one or more bugs that would negatively impact users.

Bug description: an error message is displayed when attempting to Sign in with Apple

Review device details:

- Device type: iPad Air (5th generation) 
- OS version: iPadOS 26.0

Next Steps

Test the app on supported devices to identify and resolve bugs and stability issues before submitting for review.

If the bug cannot be reproduced, try the following:

- For new apps, uninstall all previous versions of the app from a device, then install and follow the steps to reproduce.
- For app updates, install the new version as an update to the previous version, then follow the steps to reproduce.