APP STORE CONNECT REVIEWER NOTES - Team Build Pro v1.0.5

TESTING CREDENTIALS:
Email: demo@teambuildpro.com
Password: DemoPWD999!!
Note: This test account has full app access with sample team data for comprehensive testing

IMPORTANT COMPLIANCE FIXES ADDRESSED:
This version resolves two critical issues from v1.0.4 review:

1. Apple Sign-In Compliance (Guideline 4.0): Fixed seamless authentication - no additional data collection after Apple Sign-In
2. Legal Document Access (Guideline 3.1.2): Added required Terms of Service and Privacy Policy buttons in Profile screen and subscription flow

IMPORTANT: Please update our app's age rating from 4+ to 18+

REASON FOR CHANGE:

• App is designed for business professionals 18+
• Contains subscription-based business content
• Professional team management and direct sales tools
• Not appropriate for children under 18

The original 4+ rating was submitted in error during initial launch.
This is a business productivity app for adult professionals only.

KEY TESTING AREAS:

Apple Sign-In Flow:
- Tap "Sign in with Apple" on login screen
- Complete Apple authentication
- EXPECTED: Immediate sign-in to main interface without additional forms
- User profile created automatically with Apple-provided data

Legal Document Access:
- Sign in with any method and go to Profile screen
- EXPECTED: "Terms of Service" and "Privacy Policy" buttons prominently displayed
- Both documents should load properly when tapped

Subscription Testing:
- Navigate to subscription screen from Profile
- EXPECTED: Legal notice displayed with clickable Terms/Privacy links
- Links should navigate to respective legal documents

APP-SPECIFIC SETTINGS:

Business Model: Professional networking SaaS tool
Subscription: 30-day free trial, then $4.99/month via Apple In-App Purchase
Age Rating: 18+ (business tool for professional networking)
Primary Function: Team building and relationship management for direct sales professionals

FIREBASE BACKEND:
App uses Firebase Authentication, Firestore, and Cloud Functions
No special backend configuration needed for testing
All features work with standard network connectivity

REFERRAL SYSTEM TESTING:
Test referral links: https://teambuildpro.com/?ref=88888888
App handles referral parameters for team building features

CONTACT FOR REVIEW QUESTIONS:
support@teambuildpro.com
Response within 24 hours for any testing assistance needed

Version: 1.0.5+31 | Build: 31 | Submission Date: September 3, 2025