import Flutter
import UIKit
import UserNotifications
import Firebase
import FirebaseMessaging

@main
@objc class AppDelegate: FlutterAppDelegate, MessagingDelegate {

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {

    FirebaseApp.configure()

    UNUserNotificationCenter.current().delegate = self

    // Request alerts + sounds + badges
    let opts: UNAuthorizationOptions = [.alert, .badge, .sound]
    UNUserNotificationCenter.current().requestAuthorization(options: opts) { granted, err in
      // Log permission result if needed
    }

    application.registerForRemoteNotifications()

    Messaging.messaging().delegate = self

    GeneratedPluginRegistrant.register(with: self)

    // Clipboard preflight channel (safe, non-pasting)
    if let controller = window?.rootViewController as? FlutterViewController {
      let channel = FlutterMethodChannel(name: "clipboard_utils",
                                         binaryMessenger: controller.binaryMessenger)
      channel.setMethodCallHandler { call, result in
        switch call.method {
        case "hasStrings":
          result(UIPasteboard.general.hasStrings)
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // REQUIRED since app delegate proxying is disabled:
  override func application(_ application: UIApplication,
                   didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Messaging.messaging().apnsToken = deviceToken
  }

  // Foreground presentation – this enables banners while app is in foreground:
  override func userNotificationCenter(_ center: UNUserNotificationCenter,
                              willPresent notification: UNNotification,
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    // Show banner + list + sound while app is in foreground
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .list, .sound])
    } else {
      // iOS 13 fallback: use alert instead of banner/list
      completionHandler([.alert, .sound])
    }
  }

  // Optional: tap handling for background pushes
  override func userNotificationCenter(_ center: UNUserNotificationCenter,
                              didReceive response: UNNotificationResponse,
                              withCompletionHandler completionHandler: @escaping () -> Void) {
    // Handle notification tap if needed
    completionHandler()
  }

  // Optional debug to verify token
  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    // Token is already handled by Flutter FCM service
  }
}
