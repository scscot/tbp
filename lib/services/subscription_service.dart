// 📦 ALL IMPORTS AT THE TOP
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:developer' as developer;

// 🎯 SINGLE SUBSCRIPTION SERVICE CLASS
class SubscriptionService {
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  // A simple log function that only prints in debug mode
  static void _log(String message) {
    if (kDebugMode) {
      developer.log(message, name: 'SubscriptionService');
    }
  }

  // 🔧 Original admin subscription check (mocked for development)
  static Future<Map<String, dynamic>> checkAdminSubscriptionStatus(
      String uid) async {
    // ✅ TEMPORARY OVERRIDE FOR DEVELOPMENT
    _log('⚠️ Mocked checkAdminSubscriptionStatus called for uid: $uid');
    return {
      'isActive': true,
      'daysRemaining': 99,
      'trialExpired': false,
    };

    // ❌ ORIGINAL (commented out for now)
    // try {
    //   final HttpsCallable checkStatus = FirebaseFunctions.instance.httpsCallable('checkAdminSubscriptionStatus');
    //   final result = await checkStatus.call({'uid': uid});
    //   final data = Map<String, dynamic>.from(result.data);
    //   return data;
    // } catch (e) {
    //   _log('❌ Error checking subscription status: $e');
    //   return {
    //     'isActive': false,
    //     'daysRemaining': 0,
    //     'trialExpired': true,
    //   };
    // }
  }

  // 🧪 NEW: Apple Notification V2 Test Function
  Future<TestResult> testAppleNotificationV2Setup() async {
    try {
      // Ensure user is authenticated
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        return TestResult(
          success: false,
          error: 'User must be authenticated to test setup',
        );
      }

      _log('🧪 Testing Apple Notification V2 setup...');

      final HttpsCallable callable = _functions.httpsCallable(
        'testAppleNotificationV2Setup',
        options: HttpsCallableOptions(
          timeout: const Duration(seconds: 30),
        ),
      );

      final result = await callable.call();
      final data = result.data as Map<String, dynamic>;

      _log('✅ Test successful: ${data['message']}');

      return TestResult(
        success: data['success'] ?? false,
        message: data['message'] ?? 'Test completed',
        endpoint: data['endpoint'],
        timestamp: data['timestamp'],
      );
    } on FirebaseFunctionsException catch (e) {
      _log('❌ Firebase Functions Error: ${e.code} - ${e.message}');
      return TestResult(
        success: false,
        error: 'Firebase Error: ${e.message}',
        errorCode: e.code,
      );
    } catch (e) {
      _log('❌ Unexpected error: $e');
      return TestResult(
        success: false,
        error: 'Unexpected error: $e',
      );
    }
  }

  // 🧪 NEW: Google Play Notification Test Function
  Future<TestResult> testGooglePlayNotificationSetup() async {
    try {
      // Ensure user is authenticated
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        return TestResult(
          success: false,
          error: 'User must be authenticated to test setup',
        );
      }

      _log('🧪 Testing Google Play notification setup...');

      final HttpsCallable callable = _functions.httpsCallable(
        'testGooglePlayNotificationSetup',
        options: HttpsCallableOptions(
          timeout: const Duration(seconds: 30),
        ),
      );

      final result = await callable.call();
      final data = result.data as Map<String, dynamic>;

      _log('✅ Test successful: ${data['message']}');

      return TestResult(
        success: data['success'] ?? false,
        message: data['message'] ?? 'Test completed',
        endpoint: data['endpoint'],
        timestamp: data['timestamp'],
      );
    } on FirebaseFunctionsException catch (e) {
      _log('❌ Firebase Functions Error: ${e.code} - ${e.message}');
      return TestResult(
        success: false,
        error: 'Firebase Error: ${e.message}',
        errorCode: e.code,
      );
    } catch (e) {
      _log('❌ Unexpected error: $e');
      return TestResult(
        success: false,
        error: 'Unexpected error: $e',
      );
    }
  }
}

// 📊 RESULT CLASS FOR TEST RESPONSES
class TestResult {
  final bool success;
  final String? message;
  final String? endpoint;
  final String? timestamp;
  final String? error;
  final String? errorCode;

  TestResult({
    required this.success,
    this.message,
    this.endpoint,
    this.timestamp,
    this.error,
    this.errorCode,
  });

  @override
  String toString() {
    if (success) {
      return 'SUCCESS: $message\nEndpoint: $endpoint\nTime: $timestamp';
    } else {
      return 'ERROR: $error${errorCode != null ? ' (Code: $errorCode)' : ''}';
    }
  }
}

// 🎨 APPLE NOTIFICATION TEST WIDGET
class AppleNotificationTestWidget extends StatefulWidget {
  const AppleNotificationTestWidget({super.key});

  @override
  State<AppleNotificationTestWidget> createState() =>
      _AppleNotificationTestWidgetState();
}

// 🎨 GOOGLE PLAY NOTIFICATION TEST WIDGET
class GoogleNotificationTestWidget extends StatefulWidget {
  const GoogleNotificationTestWidget({super.key});

  @override
  State<GoogleNotificationTestWidget> createState() =>
      _GoogleNotificationTestWidgetState();
}

class _AppleNotificationTestWidgetState
    extends State<AppleNotificationTestWidget> {
  final SubscriptionService _subscriptionService = SubscriptionService();
  bool _isLoading = false;
  TestResult? _lastResult;

  Future<void> _runTest() async {
    setState(() {
      _isLoading = true;
      _lastResult = null;
    });

    try {
      final result = await _subscriptionService.testAppleNotificationV2Setup();
      setState(() {
        _lastResult = result;
      });

      // Show result dialog
      if (mounted) {
        _showResultDialog(result);
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showResultDialog(TestResult result) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(
              result.success ? Icons.check_circle : Icons.error,
              color: result.success ? Colors.green : Colors.red,
            ),
            const SizedBox(width: 8),
            Text(result.success ? 'Test Successful' : 'Test Failed'),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (result.success) ...[
                Text('✅ ${result.message}'),
                const SizedBox(height: 16),
                const Text('Endpoint URL:',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                SelectableText(
                  result.endpoint ?? 'Not provided',
                  style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                ),
                const SizedBox(height: 8),
                if (result.timestamp != null) ...[
                  const Text('Timestamp:',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  Text(result.timestamp!),
                ],
              ] else ...[
                Text('❌ ${result.error}'),
                if (result.errorCode != null) ...[
                  const SizedBox(height: 8),
                  Text('Error Code: ${result.errorCode}'),
                ],
              ],
            ],
          ),
        ),
        actions: [
          if (result.success && result.endpoint != null)
            TextButton(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: result.endpoint!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Endpoint URL copied to clipboard')),
                );
              },
              child: const Text('Copy URL'),
            ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.apple, size: 24),
                const SizedBox(width: 8),
                const Text(
                  'Apple Notification V2 Test',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'Test your Apple App Store Server Notification V2 endpoint to ensure it\'s properly configured.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 16),

            // Test Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _runTest,
                child: _isLoading
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 8),
                          Text('Testing...'),
                        ],
                      )
                    : const Text('Run V2 Setup Test'),
              ),
            ),

            // Last Result Summary
            if (_lastResult != null) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _lastResult!.success
                      ? Colors.green.withValues(alpha: 0.1)
                      : Colors.red.withValues(alpha: 0.1),
                  border: Border.all(
                    color: _lastResult!.success ? Colors.green : Colors.red,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          _lastResult!.success
                              ? Icons.check_circle
                              : Icons.error,
                          color:
                              _lastResult!.success ? Colors.green : Colors.red,
                          size: 16,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Last Test: ${_lastResult!.success ? 'SUCCESS' : 'FAILED'}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: _lastResult!.success
                                ? Colors.green
                                : Colors.red,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _lastResult!.success
                          ? _lastResult!.message ??
                              'Test completed successfully'
                          : _lastResult!.error ?? 'Test failed',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _GoogleNotificationTestWidgetState
    extends State<GoogleNotificationTestWidget> {
  final SubscriptionService _subscriptionService = SubscriptionService();
  bool _isLoading = false;
  TestResult? _lastResult;

  Future<void> _runTest() async {
    setState(() {
      _isLoading = true;
      _lastResult = null;
    });

    try {
      final result = await _subscriptionService.testGooglePlayNotificationSetup();
      setState(() {
        _lastResult = result;
      });

      // Show result dialog
      if (mounted) {
        _showResultDialog(result);
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showResultDialog(TestResult result) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(
              result.success ? Icons.check_circle : Icons.error,
              color: result.success ? Colors.green : Colors.red,
            ),
            const SizedBox(width: 8),
            Text(result.success ? 'Test Successful' : 'Test Failed'),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (result.success) ...[ 
                Text('✅ ${result.message}'),
                const SizedBox(height: 16),
                const Text('Endpoint URL:',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                SelectableText(
                  result.endpoint ?? 'Not provided',
                  style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                ),
                const SizedBox(height: 8),
                if (result.timestamp != null) ...[
                  const Text('Timestamp:',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  Text(result.timestamp!),
                ],
              ] else ...[
                Text('❌ ${result.error}'),
                if (result.errorCode != null) ...[
                  const SizedBox(height: 8),
                  Text('Error Code: ${result.errorCode}'),
                ],
              ],
            ],
          ),
        ),
        actions: [
          if (result.success && result.endpoint != null)
            TextButton(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: result.endpoint!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Endpoint URL copied to clipboard')),
                );
              },
              child: const Text('Copy URL'),
            ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.android, size: 24),
                const SizedBox(width: 8),
                const Text(
                  'Google Play Notification Test',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'Test your Google Play Developer notification endpoint to ensure it\'s properly configured.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 16),

            // Test Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _runTest,
                child: _isLoading
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 8),
                          Text('Testing...'),
                        ],
                      )
                    : const Text('Run Google Play Test'),
              ),
            ),

            // Last Result Summary
            if (_lastResult != null) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _lastResult!.success
                      ? Colors.green.withValues(alpha: 0.1)
                      : Colors.red.withValues(alpha: 0.1),
                  border: Border.all(
                    color: _lastResult!.success ? Colors.green : Colors.red,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          _lastResult!.success
                              ? Icons.check_circle
                              : Icons.error,
                          color:
                              _lastResult!.success ? Colors.green : Colors.red,
                          size: 16,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Last Test: ${_lastResult!.success ? 'SUCCESS' : 'FAILED'}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: _lastResult!.success
                                ? Colors.green
                                : Colors.red,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _lastResult!.success
                          ? _lastResult!.message ??
                              'Test completed successfully'
                          : _lastResult!.error ?? 'Test failed',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// 🎯 DEBUG SCREEN EXAMPLE
class DebugScreen extends StatelessWidget {
  const DebugScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Debug & Testing'),
      ),
      body: const SingleChildScrollView(
        child: Column(
          children: [
            // Add the Apple Notification Test Widget
            AppleNotificationTestWidget(),

            // Other test widgets can go here...
          ],
        ),
      ),
    );
  }
}

// 🚀 QUICK TEST FUNCTION FOR IMMEDIATE USE
Future<void> quickTestAppleNotificationV2(BuildContext context) async {
  final subscriptionService = SubscriptionService();

  // Show loading
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => const AlertDialog(
      content: Row(
        children: [
          CircularProgressIndicator(),
          SizedBox(width: 16),
          Text('Testing Apple V2 setup...'),
        ],
      ),
    ),
  );

  try {
    final result = await subscriptionService.testAppleNotificationV2Setup();

    // Close loading dialog
    if (context.mounted) Navigator.pop(context);

    // Show result
    if (context.mounted) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(result.success ? '✅ Success' : '❌ Failed'),
          content: Text(result.toString()),
          actions: [
            if (result.success && result.endpoint != null)
              TextButton(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: result.endpoint!));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Endpoint copied!')),
                  );
                },
                child: const Text('Copy URL'),
              ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
  } catch (e) {
    // Close loading dialog
    if (context.mounted) Navigator.pop(context);

    // Show error
    if (context.mounted) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('❌ Error'),
          content: Text('Failed to test setup: $e'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
  }
}
