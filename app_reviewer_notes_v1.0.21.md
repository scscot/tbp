App Reviewer Notes - Version 1.0.21+48

Summary of Changes

This update enhances user experience and addresses App Store listing concerns.

User Experience Improvements

- Added "Forgot Password?" link on login screen for improved user access
- Users can now reset passwords directly within the app
- Implements secure Firebase Auth password reset with email confirmation
- Provides clear success/error messaging for better user guidance

Subscription Configuration Notice

Our app is properly configured as a subscription-based service in App Store Connect:

- Product ID 1001 is correctly set up as an auto-renewable subscription
- Subscription is approved and assigned to subscription group "Team Build Pro"
- App description clearly indicates monthly subscription pricing ($4.99/month) with 30-day free trial
- All subscription functionality is fully implemented and working correctly

App Store Listing Display Issue:

Despite proper subscription configuration, the App Store listing currently displays "one-time purchase" instead of "subscription." This appears to be an App Store presentation issue rather than a configuration problem. Our subscription setup is fully compliant with App Store Connect guidelines and subscription functionality works as expected.

Build Information
Version: 1.0.21+48
Previous Version: 1.0.20+47
Compatibility: iOS 13.0+ (iPhone and iPad)