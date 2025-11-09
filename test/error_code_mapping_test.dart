import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:ultimatefix/i18n/error_codes.dart';
import 'package:ultimatefix/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

void main() {
  group('AuthErrorCodes Mapping Tests', () {
    late AppLocalizations l10n;

    setUpAll(() async {
      l10n = await AppLocalizations.delegate.load(const Locale('en'));
    });

    test('all Firebase error codes map to valid localization keys', () {
      // Table of all supported Firebase error codes
      final firebaseErrorCodes = [
        'auth/invalid-email',
        'auth/user-disabled',
        'auth/user-not-found',
        'auth/wrong-password',
        'auth/email-already-in-use',
        'auth/weak-password',
        'auth/network-request-failed',
        'auth/too-many-requests',
        'auth/invalid-credential',
      ];

      // Verify each Firebase code maps to a localization key
      for (final firebaseCode in firebaseErrorCodes) {
        final localizationKey = AuthErrorCodes.getLocalizationKey(firebaseCode);

        // Should not fall back to unknown
        expect(
          localizationKey,
          isNot('authErrorUnknown'),
          reason: 'Firebase code "$firebaseCode" should have explicit mapping',
        );

        // Should return a non-null, non-empty string
        expect(localizationKey, isNotNull);
        expect(localizationKey, isNotEmpty);
      }
    });

    test('unmapped error code returns authErrorUnknown', () {
      final result = AuthErrorCodes.getLocalizationKey('auth/fake-error-code');
      expect(result, equals('authErrorUnknown'));
    });

    test('all mapped keys exist in English locale', () {
      // Get all mapped localization keys
      final mappedKeys = AuthErrorCodes.firebaseToKey.values.toSet();

      // Verify each key can be accessed (will throw if key doesn't exist)
      for (final key in mappedKeys) {
        String? localizedValue;

        switch (key) {
          case 'authErrorInvalidEmail':
            localizedValue = l10n.authErrorInvalidEmail;
            break;
          case 'authErrorUserDisabled':
            localizedValue = l10n.authErrorUserDisabled;
            break;
          case 'authErrorUserNotFound':
            localizedValue = l10n.authErrorUserNotFound;
            break;
          case 'authErrorWrongPassword':
            localizedValue = l10n.authErrorWrongPassword;
            break;
          case 'authErrorEmailInUse':
            localizedValue = l10n.authErrorEmailInUse;
            break;
          case 'authErrorWeakPassword':
            localizedValue = l10n.authErrorWeakPassword;
            break;
          case 'authErrorNetworkError':
            localizedValue = l10n.authErrorNetworkError;
            break;
          case 'authErrorTooMany':
            localizedValue = l10n.authErrorTooMany;
            break;
          case 'authErrorInvalidCredential':
            localizedValue = l10n.authErrorInvalidCredential;
            break;
          default:
            fail('Unmapped key in test: $key');
        }

        expect(localizedValue, isNotNull);
        expect(localizedValue, isNotEmpty);
      }
    });

    test('fallback key authErrorUnknown exists in English locale', () {
      expect(l10n.authErrorUnknown, isNotNull);
      expect(l10n.authErrorUnknown, isNotEmpty);
    });

    test('all error messages are user-friendly (not technical)', () {
      final errorMessages = [
        l10n.authErrorInvalidEmail,
        l10n.authErrorUserDisabled,
        l10n.authErrorUserNotFound,
        l10n.authErrorWrongPassword,
        l10n.authErrorEmailInUse,
        l10n.authErrorWeakPassword,
        l10n.authErrorNetworkError,
        l10n.authErrorTooMany,
        l10n.authErrorInvalidCredential,
        l10n.authErrorUnknown,
      ];

      for (final message in errorMessages) {
        // Should not contain technical Firebase codes
        expect(message.toLowerCase(), isNot(contains('auth/')));
        expect(message.toLowerCase(), isNot(contains('firebase')));

        // Should be reasonably short (error messages, not essays)
        expect(message.length, lessThan(120));

        // Should start with capital letter (proper sentence)
        expect(message[0], equals(message[0].toUpperCase()));
      }
    });

    test('error code mapping is complete (no missing codes)', () {
      // Common Firebase Auth error codes that should be mapped
      final commonFirebaseErrors = [
        'auth/invalid-email',
        'auth/user-disabled',
        'auth/user-not-found',
        'auth/wrong-password',
        'auth/email-already-in-use',
        'auth/weak-password',
        'auth/network-request-failed',
        'auth/too-many-requests',
        'auth/invalid-credential',
      ];

      for (final errorCode in commonFirebaseErrors) {
        expect(
          AuthErrorCodes.firebaseToKey.containsKey(errorCode),
          isTrue,
          reason: 'Common Firebase error "$errorCode" should be mapped',
        );
      }
    });

    test('all mapped keys exist in ARB file (prevents stale keys)', () {
      final arbFile = File('lib/l10n/app_en.arb');
      expect(arbFile.existsSync(), isTrue, reason: 'ARB file must exist');

      final arbContent = arbFile.readAsStringSync();
      final arbData = jsonDecode(arbContent) as Map<String, dynamic>;

      final allMappedKeys = AuthErrorCodes.firebaseToKey.values.toSet();
      allMappedKeys.add('authErrorUnknown');

      for (final key in allMappedKeys) {
        expect(
          arbData.containsKey(key),
          isTrue,
          reason: 'ARB key "$key" from error_codes.dart must exist in app_en.arb',
        );

        expect(
          arbData[key],
          isNotNull,
          reason: 'ARB value for "$key" must not be null',
        );

        expect(
          arbData[key],
          isA<String>(),
          reason: 'ARB value for "$key" must be a string',
        );

        expect(
          (arbData[key] as String).isNotEmpty,
          isTrue,
          reason: 'ARB value for "$key" must not be empty',
        );
      }
    });
  });
}
