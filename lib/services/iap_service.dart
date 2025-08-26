import 'dart:async';
import 'dart:io' show Platform;
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class IAPService {
  static final IAPService _instance = IAPService._internal();
  factory IAPService() => _instance;
  IAPService._internal();

  final InAppPurchase _iap = InAppPurchase.instance;
  final FirebaseFunctions _functions =
      FirebaseFunctions.instanceFor(region: 'us-central1');
  late StreamSubscription<List<PurchaseDetails>> _subscription;
  final String _subscriptionId = '1001';

  bool available = false;
  List<ProductDetails> products = [];
  bool isPurchased = false;

  // --- PHASE 3: Enhanced subscription management ---
  String? _currentSubscriptionStatus;
  DateTime? _subscriptionExpiry;
  bool _isTrialValid = false;
  int _trialDaysRemaining = 0;

  Future<void> init() async {
    available = await _iap.isAvailable();
    if (!available) {
      debugPrint('⚠️ IAP not available');
      return;
    }

    final ProductDetailsResponse response =
        await _iap.queryProductDetails({_subscriptionId});
    if (response.error != null || response.productDetails.isEmpty) {
      debugPrint('❌ Error loading products: ${response.error}');
      return;
    }
    products = response.productDetails;
    debugPrint('✅ Loaded IAP products');

    _subscription = _iap.purchaseStream.listen(_onPurchaseUpdated, onDone: () {
      _subscription.cancel();
    }, onError: (error) {
      debugPrint('❌ Purchase stream error: $error');
    });
  }

  void _onPurchaseUpdated(List<PurchaseDetails> purchases) {
    for (var purchase in purchases) {
      if (purchase.status == PurchaseStatus.purchased ||
          purchase.status == PurchaseStatus.restored) {
        isPurchased = true;
        _verifyAndCompleteSubscription(purchase);
      } else if (purchase.status == PurchaseStatus.error) {
        debugPrint('❌ Purchase error: ${purchase.error}');
      } else if (purchase.status == PurchaseStatus.pending) {
        debugPrint('⏳ Purchase pending: ${purchase.productID}');
      }
    }
  }

  /// Enhanced verification that validates receipts with Apple/Google Play and updates subscription status
  Future<void> _verifyAndCompleteSubscription(PurchaseDetails purchase) async {
    try {
      debugPrint('📱 SUBSCRIPTION: Verifying purchase: ${purchase.productID}');

      // Determine platform and use appropriate validation
      if (Platform.isIOS) {
        await _verifyApplePurchase(purchase);
      } else if (Platform.isAndroid) {
        await _verifyGooglePlayPurchase(purchase);
      } else {
        debugPrint('❌ SUBSCRIPTION: Unsupported platform');
        return;
      }

      // Complete the purchase
      if (purchase.pendingCompletePurchase) {
        await _iap.completePurchase(purchase);
        debugPrint('✅ SUBSCRIPTION: Purchase completed');
      }
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION: Error verifying purchase: $e');

      // Still complete the purchase to avoid issues
      if (purchase.pendingCompletePurchase) {
        await _iap.completePurchase(purchase);
      }
    }
  }

  /// Verify Apple App Store purchase
  Future<void> _verifyApplePurchase(PurchaseDetails purchase) async {
    try {
      // Get receipt data for validation
      final receiptData = purchase.verificationData.serverVerificationData;

      if (receiptData.isEmpty) {
        debugPrint('❌ APPLE SUBSCRIPTION: No receipt data available');
        return;
      }

      // Validate receipt with our Firebase Function
      final validateFunction = _functions.httpsCallable('validateAppleReceipt');
      final result = await validateFunction.call({
        'receiptData': receiptData,
      });

      final validationResult = result.data as Map<String, dynamic>;

      if (validationResult['isValid'] == true) {
        debugPrint('✅ APPLE SUBSCRIPTION: Receipt validated successfully');

        // Update local subscription status
        _currentSubscriptionStatus = validationResult['subscriptionStatus'];
        if (validationResult['expiresDate'] != null) {
          _subscriptionExpiry = DateTime.parse(validationResult['expiresDate']);
        }

        isPurchased = _currentSubscriptionStatus == 'active';

        debugPrint('📱 APPLE SUBSCRIPTION: Status updated to: $_currentSubscriptionStatus');
      } else {
        debugPrint('❌ APPLE SUBSCRIPTION: Receipt validation failed: ${validationResult['message']}');
      }
    } catch (e) {
      debugPrint('❌ APPLE SUBSCRIPTION: Error validating receipt: $e');
      rethrow;
    }
  }

  /// Verify Google Play Store purchase
  Future<void> _verifyGooglePlayPurchase(PurchaseDetails purchase) async {
    try {
      // Get purchase token for validation
      final purchaseToken = purchase.verificationData.serverVerificationData;

      if (purchaseToken.isEmpty) {
        debugPrint('❌ GOOGLE PLAY SUBSCRIPTION: No purchase token available');
        return;
      }

      // Get package name from the app
      const packageName = 'com.scott.ultimatefix'; // Your app's package name

      // Store purchase token in user document for webhook notifications
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        await FirebaseFirestore.instance.collection('users').doc(user.uid).update({
          'googlePlayPurchaseToken': purchaseToken,
          'lastPurchaseUpdate': FieldValue.serverTimestamp(),
        });
      }

      // Validate purchase with our Firebase Function
      final validateFunction = _functions.httpsCallable('validateGooglePlayPurchase');
      final result = await validateFunction.call({
        'purchaseToken': purchaseToken,
        'productId': purchase.productID,
        'packageName': packageName,
      });

      final validationResult = result.data as Map<String, dynamic>;

      if (validationResult['isValid'] == true) {
        debugPrint('✅ GOOGLE PLAY SUBSCRIPTION: Purchase validated successfully');

        // Update local subscription status
        _currentSubscriptionStatus = validationResult['subscriptionStatus'];
        if (validationResult['expiresDate'] != null) {
          _subscriptionExpiry = DateTime.parse(validationResult['expiresDate']);
        }

        isPurchased = _currentSubscriptionStatus == 'active';

        debugPrint('📱 GOOGLE PLAY SUBSCRIPTION: Status updated to: $_currentSubscriptionStatus');
        debugPrint('📱 GOOGLE PLAY SUBSCRIPTION: Order ID: ${validationResult['orderId']}');
        debugPrint('📱 GOOGLE PLAY SUBSCRIPTION: Auto-renewing: ${validationResult['autoRenewing']}');
      } else {
        debugPrint('❌ GOOGLE PLAY SUBSCRIPTION: Purchase validation failed: ${validationResult['message']}');
      }
    } catch (e) {
      debugPrint('❌ GOOGLE PLAY SUBSCRIPTION: Error validating purchase: $e');
      rethrow;
    }
  }

  /// Enhanced subscription purchase with proper subscription handling
  Future<void> purchaseMonthlySubscription({
    required VoidCallback onSuccess,
    required VoidCallback onFailure,
    VoidCallback? onComplete,
  }) async {
    try {
      debugPrint('📱 SUBSCRIPTION: Starting subscription purchase');

      if (!available || products.isEmpty) {
        debugPrint('❌ SUBSCRIPTION: IAP not available or no products loaded');
        onFailure();
        return;
      }

      final product = products.firstWhere((p) => p.id == _subscriptionId);

      // Set application username to user ID for server-to-server notifications
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        debugPrint('❌ SUBSCRIPTION: User not authenticated');
        onFailure();
        return;
      }

      final purchaseParam = PurchaseParam(
        productDetails: product,
        applicationUserName:
            user.uid, // This helps Apple link purchases to users
      );

      // Use buyConsumable for subscriptions (not buyNonConsumable)
      final success = await _iap.buyConsumable(purchaseParam: purchaseParam);

      if (success) {
        debugPrint('✅ SUBSCRIPTION: Purchase initiated successfully');
        onSuccess();
      } else {
        debugPrint('❌ SUBSCRIPTION: Purchase initiation failed');
        onFailure();
      }
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION: Error purchasing subscription: $e');
      onFailure();
    } finally {
      onComplete?.call();
    }
  }

  /// Legacy method for backward compatibility
  Future<void> purchaseMonthlyUpgrade({
    required VoidCallback onSuccess,
    required VoidCallback onFailure,
    VoidCallback? onComplete,
  }) async {
    return purchaseMonthlySubscription(
      onSuccess: onSuccess,
      onFailure: onFailure,
      onComplete: onComplete,
    );
  }

  /// Check current subscription status from Firebase
  Future<Map<String, dynamic>> checkSubscriptionStatus() async {
    try {
      debugPrint('📱 SUBSCRIPTION: Checking subscription status');

      final checkFunction =
          _functions.httpsCallable('checkUserSubscriptionStatus');
      final result = await checkFunction.call();

      final statusData = result.data as Map<String, dynamic>;

      // Update local state
      _currentSubscriptionStatus = statusData['subscriptionStatus'];
      _isTrialValid = statusData['isTrialValid'] ?? false;
      _trialDaysRemaining = statusData['trialDaysRemaining'] ?? 0;

      if (statusData['subscriptionExpiry'] != null) {
        _subscriptionExpiry = DateTime.parse(statusData['subscriptionExpiry']);
      }

      isPurchased = statusData['isActive'] ?? false;

      debugPrint(
          '✅ SUBSCRIPTION: Status checked - Active: $isPurchased, Status: $_currentSubscriptionStatus');

      return statusData;
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION: Error checking subscription status: $e');
      return {
        'subscriptionStatus': 'trial',
        'isActive': _isTrialValid,
        'isTrialValid': _isTrialValid,
        'trialDaysRemaining': _trialDaysRemaining,
        'isExpired': false,
        'isInGracePeriod': false,
      };
    }
  }

  /// Validate current subscription with Apple
  Future<void> validateSubscription() async {
    try {
      debugPrint('📱 SUBSCRIPTION: Validating current subscription');

      // For iOS, we'll use the receipt data from the most recent purchase
      // The getReceiptData method doesn't exist in the current package version
      // Instead, we'll rely on the purchase stream and server-to-server notifications

      // Check subscription status from Firebase instead
      await checkSubscriptionStatus();
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION: Error validating subscription: $e');
    }
  }

  /// Restore previous purchases
  Future<void> restorePurchases({
    VoidCallback? onSuccess,
    VoidCallback? onFailure,
  }) async {
    try {
      debugPrint('📱 SUBSCRIPTION: Restoring purchases');

      await _iap.restorePurchases();

      // After restore, validate current subscription status
      await validateSubscription();

      if (isPurchased) {
        debugPrint('✅ SUBSCRIPTION: Purchases restored successfully');
        onSuccess?.call();
      } else {
        debugPrint(
            '⚠️ SUBSCRIPTION: No active subscription found after restore');
        onFailure?.call();
      }
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION: Error restoring purchases: $e');
      onFailure?.call();
    }
  }

  // --- PHASE 3: Getters for subscription status ---

  String get subscriptionStatus => _currentSubscriptionStatus ?? 'trial';
  DateTime? get subscriptionExpiry => _subscriptionExpiry;
  bool get isTrialValid => _isTrialValid;
  int get trialDaysRemaining => _trialDaysRemaining;
  bool get isSubscriptionActive => isPurchased;

  bool get isInGracePeriod {
    return _currentSubscriptionStatus == 'cancelled' &&
        _subscriptionExpiry != null &&
        DateTime.now().isBefore(_subscriptionExpiry!);
  }

  bool get isExpired {
    if (_currentSubscriptionStatus == 'expired') return true;
    if (_subscriptionExpiry == null) return false;
    return DateTime.now().isAfter(_subscriptionExpiry!);
  }

  void dispose() {
    _subscription.cancel();
  }
}
