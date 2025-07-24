import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

class LinkValidatorService {
  static Future<bool> validateReferralUrl(String url) async {
    try {
      final HttpsCallable callable =
          FirebaseFunctions.instance.httpsCallable('validateReferralUrl');
      final response = await callable.call(<String, dynamic>{'url': url});

      if (response.data['valid'] == true) {
        return true;
      } else {
        debugPrint('Validation failed: ${response.data}');
        return false;
      }
    } catch (e) {
      debugPrint('Error validating URL: $e');
      return false;
    }
  }
}
