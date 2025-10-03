# iOS AppDelegate/SceneDelegate Verification for Branch Integration

## Purpose
Verify that the Branch Flutter plugin properly hooks into iOS native Universal Link and URL scheme handling.

## AppDelegate.swift Verification Code

Add this logging code to your `ios/Runner/AppDelegate.swift` to verify Branch integration:

```swift
import UIKit
import Flutter

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // Add Branch verification logging
    print("🍎 AppDelegate: didFinishLaunchingWithOptions called")
    if let url = launchOptions?[.url] as? URL {
      print("🍎 AppDelegate: Launched with URL: \(url)")
    }
    if let userActivity = launchOptions?[.userActivityDictionary] as? [String: Any] {
      print("🍎 AppDelegate: Launched with userActivity: \(userActivity)")
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Universal Links handling
  override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    print("🔗 AppDelegate: Universal Link received")
    print("🔗 AppDelegate: Activity type: \(userActivity.activityType)")
    if let url = userActivity.webpageURL {
      print("🔗 AppDelegate: URL: \(url)")
    }

    // Branch plugin should handle this automatically
    let result = super.application(application, continue: userActivity, restorationHandler: restorationHandler)
    print("🔗 AppDelegate: Super method returned: \(result)")
    return result
  }

  // URL Scheme handling (fallback)
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    print("🔗 AppDelegate: URL scheme received: \(url)")
    print("🔗 AppDelegate: Options: \(options)")

    // Branch plugin should handle this automatically
    let result = super.application(app, open: url, options: options)
    print("🔗 AppDelegate: Super method returned: \(result)")
    return result
  }
}
```

## SceneDelegate.swift Verification (if using)

If your app uses SceneDelegate, add this to `ios/Runner/SceneDelegate.swift`:

```swift
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    print("🍎 SceneDelegate: willConnectTo called")

    // Check for Universal Links
    if let userActivity = connectionOptions.userActivities.first {
      print("🔗 SceneDelegate: Universal Link on launch")
      print("🔗 SceneDelegate: Activity type: \(userActivity.activityType)")
      if let url = userActivity.webpageURL {
        print("🔗 SceneDelegate: URL: \(url)")
      }
    }

    // Check for URL schemes
    if let urlContext = connectionOptions.urlContexts.first {
      print("🔗 SceneDelegate: URL scheme on launch: \(urlContext.url)")
    }

    guard let _ = (scene as? UIWindowScene) else { return }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    print("🔗 SceneDelegate: Universal Link received")
    print("🔗 SceneDelegate: Activity type: \(userActivity.activityType)")
    if let url = userActivity.webpageURL {
      print("🔗 SceneDelegate: URL: \(url)")
    }

    // Branch plugin should handle this automatically
    // No need to call super since this is UISceneDelegate
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    if let url = URLContexts.first?.url {
      print("🔗 SceneDelegate: URL scheme received: \(url)")
    }

    // Branch plugin should handle this automatically
  }
}
```

## Testing Procedure

### 1. Build and Install App
```bash
flutter build ios --debug
# Install on device via Xcode
```

### 2. Monitor Logs
Open Xcode → Window → Devices and Simulators → Select device → Open Console

Filter for: `AppDelegate` or `SceneDelegate`

### 3. Test Universal Links
```bash
# Test direct Universal Link
xcrun simctl openurl booted "https://teambuildpro.com/join/88888888?ref=88888888"
```

**Expected Logs:**
```
🔗 AppDelegate: Universal Link received
🔗 AppDelegate: Activity type: NSUserActivityTypeBrowsingWeb
🔗 AppDelegate: URL: https://teambuildpro.com/join/88888888?ref=88888888
🔗 AppDelegate: Super method returned: true
🌿 Branch: Session data received: {+clicked_branch_link: true, ref: 88888888, ...}
```

### 4. Test Branch Links
Create a Branch link in dashboard → tap on device

**Expected Logs:**
```
🔗 AppDelegate: Universal Link received
🔗 AppDelegate: URL: https://teambuildpro.app.link/xyz123
🌿 Branch: Session data received: {+clicked_branch_link: true, ref: 88888888, ...}
```

### 5. Test URL Schemes (if configured)
```bash
xcrun simctl openurl booted "teambuildpro://join?ref=88888888"
```

**Expected Logs:**
```
🔗 AppDelegate: URL scheme received: teambuildpro://join?ref=88888888
🔗 AppDelegate: Super method returned: true
```

## Troubleshooting

### No Universal Link Logs
- Verify AASA file accessibility
- Check Associated Domains in Xcode
- Confirm app ID matches AASA

### Branch Not Receiving Data
- Verify Branch key configuration
- Check Branch dashboard for click events
- Ensure internet connectivity

### URL Schemes Not Working
- Verify URL scheme registered in Info.plist
- Check if competing apps handle same scheme

## Success Criteria

✅ Universal Links trigger AppDelegate/SceneDelegate methods
✅ Branch plugin receives and processes link data
✅ Flutter side receives referral codes via DeepLinkService
✅ Registration screen shows sponsor information

---
*Use this verification code to ensure proper iOS native integration before production deployment.*