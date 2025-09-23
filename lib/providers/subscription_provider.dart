// lib/providers/subscription_provider.dart

import 'dart:async';
import 'package:flutter/foundation.dart';
import '../services/iap_service.dart';
import '../services/admin_settings_service.dart';

/// Enhanced SubscriptionProvider with ChangeNotifier for centralized subscription state management
/// Manages subscription status, purchases, and related business logic
class SubscriptionProvider extends ChangeNotifier {
  // ==============================
  // Services
  // ==============================
  final IAPService _iapService = IAPService();
  final AdminSettingsService _adminSettingsService = AdminSettingsService();

  // ==============================
  // State Management Properties
  // ==============================
  SubscriptionState _state = SubscriptionState.initial;
  bool _isPurchasing = false;
  bool _isLoading = true;
  bool _iapAvailable = false;
  Map<String, dynamic>? _subscriptionStatus;
  String? _bizOpp;
  String? _errorMessage;
  List<dynamic> _products = [];

  // ==============================
  // Getters
  // ==============================
  SubscriptionState get state => _state;
  bool get isPurchasing => _isPurchasing;
  bool get isLoading => _isLoading;
  bool get iapAvailable => _iapAvailable;
  Map<String, dynamic>? get subscriptionStatus => _subscriptionStatus;
  String? get bizOpp => _bizOpp;
  String? get errorMessage => _errorMessage;
  List<dynamic> get products => _products;

  // ==============================
  // Constructor & Initialization
  // ==============================
  SubscriptionProvider() {
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      debugPrint('🔄 SUBSCRIPTION_PROVIDER: Initializing...');
      await _initializeIAP();
      await _loadSubscriptionStatus();
      await _loadBizOppData();
      debugPrint('✅ SUBSCRIPTION_PROVIDER: Initialization complete');
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION_PROVIDER: Initialization failed: $e');
      _setError('Failed to initialize subscription service: $e');
    }
  }

  // ==============================
  // State Management Helpers
  // ==============================
  void _setState(SubscriptionState newState, {String? errorMessage}) {
    _state = newState;
    _errorMessage = errorMessage;
    notifyListeners();
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setPurchasing(bool purchasing) {
    _isPurchasing = purchasing;
    notifyListeners();
  }

  void _setError(String error) {
    _setState(SubscriptionState.error, errorMessage: error);
    _setLoading(false);
    _setPurchasing(false);
  }

  void clearError() {
    _errorMessage = null;
    if (_state == SubscriptionState.error) {
      _state = SubscriptionState.loaded;
    }
    notifyListeners();
  }

  // ==============================
  // IAP Service Methods
  // ==============================
  Future<void> _initializeIAP() async {
    try {
      debugPrint('🔄 SUBSCRIPTION_PROVIDER: Initializing IAP service');
      await _iapService.init();

      _iapAvailable = _iapService.available;
      _products = _iapService.products;

      debugPrint('✅ SUBSCRIPTION_PROVIDER: IAP service initialized');
      debugPrint('🔍 SUBSCRIPTION_PROVIDER: IAP available: $_iapAvailable');
      debugPrint('🔍 SUBSCRIPTION_PROVIDER: Products loaded: ${_products.length}');

      if (_products.isNotEmpty) {
        for (var product in _products) {
          debugPrint('🔍 SUBSCRIPTION_PROVIDER: Product: ${product.id} - ${product.title} - ${product.price}');
        }
      }
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION_PROVIDER: IAP initialization failed: $e');
      throw Exception('Failed to initialize IAP service: $e');
    }
  }

  Future<void> _loadSubscriptionStatus() async {
    try {
      debugPrint('🔄 SUBSCRIPTION_PROVIDER: Loading subscription status');
      _subscriptionStatus = await _iapService.checkSubscriptionStatus();
      debugPrint('✅ SUBSCRIPTION_PROVIDER: Subscription status loaded: $_subscriptionStatus');
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION_PROVIDER: Failed to load subscription status: $e');
      _subscriptionStatus = null;
    }
  }

  Future<void> _loadBizOppData() async {
    try {
      debugPrint('🔄 SUBSCRIPTION_PROVIDER: Loading biz opp data');
      // Use fallback since we don't have user context in provider initialization
      _bizOpp = await _adminSettingsService.getBizOppName(null, fallback: 'your business opportunity');
      debugPrint('✅ SUBSCRIPTION_PROVIDER: Biz opp data loaded: $_bizOpp');
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION_PROVIDER: Failed to load biz opp data: $e');
      _bizOpp = 'your business opportunity'; // Fallback value
    }

    _setLoading(false);
    _setState(SubscriptionState.loaded);
  }

  // ==============================
  // Purchase Methods
  // ==============================
  Future<bool> purchaseSubscription(String productId) async {
    try {
      _setPurchasing(true);
      debugPrint('🔄 SUBSCRIPTION_PROVIDER: Starting purchase for product: $productId');

      bool purchaseSuccess = false;
      String? purchaseError;

      await _iapService.purchaseMonthlySubscription(
        onSuccess: () {
          purchaseSuccess = true;
        },
        onFailure: () {
          purchaseError = 'Purchase failed or was cancelled';
        },
      );

      if (purchaseSuccess) {
        debugPrint('✅ SUBSCRIPTION_PROVIDER: Purchase successful');
        await _loadSubscriptionStatus(); // Refresh subscription status
        _setState(SubscriptionState.purchaseSuccess);
        return true;
      } else {
        debugPrint('❌ SUBSCRIPTION_PROVIDER: Purchase failed');
        _setError(purchaseError ?? 'Purchase failed or was cancelled');
        return false;
      }
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION_PROVIDER: Purchase error: $e');
      _setError('Purchase error: $e');
      return false;
    } finally {
      _setPurchasing(false);
    }
  }

  Future<bool> restorePurchases() async {
    try {
      _setLoading(true);
      debugPrint('🔄 SUBSCRIPTION_PROVIDER: Restoring purchases');

      bool restoreSuccess = false;
      String? restoreError;

      await _iapService.restorePurchases(
        onSuccess: () {
          restoreSuccess = true;
        },
        onFailure: () {
          restoreError = 'No purchases found to restore';
        },
      );

      if (restoreSuccess) {
        debugPrint('✅ SUBSCRIPTION_PROVIDER: Purchases restored successfully');
        await _loadSubscriptionStatus(); // Refresh subscription status
        _setState(SubscriptionState.restored);
        return true;
      } else {
        debugPrint('❌ SUBSCRIPTION_PROVIDER: No purchases to restore');
        _setError(restoreError ?? 'No purchases found to restore');
        return false;
      }
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION_PROVIDER: Restore purchases error: $e');
      _setError('Failed to restore purchases: $e');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  // ==============================
  // Refresh Methods
  // ==============================
  Future<void> refresh() async {
    try {
      _setLoading(true);
      await _loadSubscriptionStatus();
      await _loadBizOppData();
    } catch (e) {
      _setError('Failed to refresh subscription data: $e');
    }
  }

  // ==============================
  // Utility Methods
  // ==============================
  bool get hasActiveSubscription {
    if (_subscriptionStatus == null) return false;
    return _subscriptionStatus!['isActive'] == true;
  }

  bool get isTrialValid {
    if (_subscriptionStatus == null) return false;
    return _subscriptionStatus!['isTrialValid'] == true;
  }

  String? get subscriptionExpiryDate {
    if (_subscriptionStatus == null) return null;
    return _subscriptionStatus!['expiryDate'] as String?;
  }

  // ==============================
  // Disposal
  // ==============================
  @override
  void dispose() {
    _iapService.dispose();
    super.dispose();
  }
}

// ==============================
// Subscription State Enum
// ==============================
enum SubscriptionState {
  initial,
  loading,
  loaded,
  purchaseSuccess,
  restored,
  error,
}