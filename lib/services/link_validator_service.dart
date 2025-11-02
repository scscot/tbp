import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

class ValidationResult {
  final bool isValid;
  final String? error;
  final int? statusCode;

  ValidationResult({
    required this.isValid,
    this.error,
    this.statusCode,
  });
}

class LinkValidatorService {
  /// Validates a referral URL with comprehensive checks:
  /// - HTTPS enforcement
  /// - DNS validation (domain exists)
  /// - Reachability check (URL responds)
  ///
  /// Returns ValidationResult with detailed error messages
  static Future<ValidationResult> validateReferralUrl(String url) async {
    try {
      final HttpsCallable callable =
          FirebaseFunctions.instanceFor(region: 'us-central1')
              .httpsCallable('validateReferralUrl');

      final response = await callable.call(<String, dynamic>{'url': url});
      final data = response.data as Map<String, dynamic>;

      if (data['valid'] == true) {
        return ValidationResult(
          isValid: true,
          statusCode: data['status'] as int?,
        );
      } else {
        final error = data['error'] as String? ?? 'URL validation failed';
        debugPrint('🔗 URL Validation failed: $error');
        return ValidationResult(
          isValid: false,
          error: error,
        );
      }
    } catch (e) {
      debugPrint('❌ Error validating URL: $e');
      // Provide user-friendly error message based on error type
      String errorMessage;
      if (e.toString().contains('fetch failed') || e.toString().contains('network')) {
        errorMessage = 'The referral link you entered could not be verified. Please check your internet connection and try again.';
      } else if (e.toString().contains('timeout')) {
        errorMessage = 'The referral link validation timed out. Please try again.';
      } else {
        errorMessage = 'The referral link you entered could not be verified. Please check the URL and try again.';
      }

      return ValidationResult(
        isValid: false,
        error: errorMessage,
      );
    }
  }

  /// Legacy method for backward compatibility - returns bool only
  @Deprecated('Use validateReferralUrl() instead for detailed error messages')
  static Future<bool> isValidReferralUrl(String url) async {
    final result = await validateReferralUrl(url);
    return result.isValid;
  }
}
