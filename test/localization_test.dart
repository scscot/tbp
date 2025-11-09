import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:ultimatefix/l10n/app_localizations.dart';

void main() {
  group('Localization Smoke Tests', () {
    final supportedLocales = [
      const Locale('en'),
      const Locale('es'),
      const Locale('pt'),
      const Locale('tl'),
    ];

    for (final locale in supportedLocales) {
      group('Locale: ${locale.languageCode}', () {
        late AppLocalizations l10n;

        setUp(() async {
          l10n = await AppLocalizations.delegate.load(locale);
        });

        test('should load successfully', () {
          expect(l10n, isNotNull);
        });

        test('should have non-null appTitle', () {
          expect(l10n.appTitle, isNotNull);
          expect(l10n.appTitle, isNotEmpty);
        });

        test('should have non-null auth login header', () {
          expect(l10n.authLoginHeaderTitle, isNotNull);
          expect(l10n.authLoginHeaderTitle, isNotEmpty);
        });

        test('should have non-null auth error messages', () {
          expect(l10n.authErrorInvalidEmail, isNotNull);
          expect(l10n.authErrorInvalidEmail, isNotEmpty);
          expect(l10n.authErrorUnknown, isNotNull);
          expect(l10n.authErrorUnknown, isNotEmpty);
        });

        test('should format ICU placeholders for password length', () {
          final minLength = 6;
          final result = l10n.authLoginPasswordTooShort(minLength);

          expect(result, isNotNull);
          expect(result, contains(minLength.toString()));
        });

        test('should format ICU placeholders for biometric method', () {
          const method = 'Face ID';
          final result = l10n.authLoginBiometric(method);

          expect(result, isNotNull);
          expect(result, contains(method));
        });
      });
    }
  });

  group('Localization Delegates', () {
    testWidgets('should provide AppLocalizations through MaterialApp', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('en'),
            Locale('es'),
            Locale('pt'),
            Locale('tl'),
          ],
          home: Builder(
            builder: (context) {
              final l10n = AppLocalizations.of(context);
              return Text(l10n!.appTitle);
            },
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify the app title is displayed
      expect(find.text('Team Build Pro'), findsOneWidget);
    });

    testWidgets('should fall back to English for unsupported locales', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('fr'), // Unsupported locale
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('en'),
            Locale('es'),
            Locale('pt'),
            Locale('tl'),
          ],
          localeResolutionCallback: (deviceLocale, supportedLocales) {
            if (deviceLocale == null) return const Locale('en');

            for (var supportedLocale in supportedLocales) {
              if (supportedLocale.languageCode == deviceLocale.languageCode) {
                return supportedLocale;
              }
            }

            return const Locale('en'); // Fallback to English
          },
          home: Builder(
            builder: (context) {
              final l10n = AppLocalizations.of(context);
              return Text(l10n!.appTitle);
            },
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Should fallback to English
      expect(find.text('Team Build Pro'), findsOneWidget);
    });
  });

  group('Recruiting Templates', () {
    final supportedLocales = [
      const Locale('en'),
      const Locale('es'),
      const Locale('pt'),
      const Locale('tl'),
    ];

    for (final locale in supportedLocales) {
      group('Locale: ${locale.languageCode}', () {
        late AppLocalizations l10n;

        setUp(() async {
          l10n = await AppLocalizations.delegate.load(locale);
        });

        test('recruitT01FirstTouch should format all placeholders', () {
          final result = l10n.recruitT01FirstTouch('María', 'Stephen', 'NeoLife', 'tbp.app/abc123');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('Stephen'));
          expect(result, contains('NeoLife'));
          expect(result, contains('tbp.app/abc123'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT01FirstTouchNoName should format all placeholders', () {
          final result = l10n.recruitT01FirstTouchNoName('Stephen', 'NeoLife', 'tbp.app/abc123');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('Stephen'));
          expect(result, contains('NeoLife'));
          expect(result, contains('tbp.app/abc123'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT02FollowUpWarm should format all placeholders', () {
          final result = l10n.recruitT02FollowUpWarm('María', 'NeoLife', 'tbp.app/abc123');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, contains('tbp.app/abc123'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT03DeadlineNudge should format all placeholders', () {
          final result = l10n.recruitT03DeadlineNudge('María', 'NeoLife', 'tbp.app/abc123');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, contains('tbp.app/abc123'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT04TeamNeeded should format plural correctly', () {
          final resultZero = l10n.recruitT04TeamNeeded(0);
          expect(resultZero, isNotNull);
          expect(resultZero, isNot(contains('{')));
          expect(resultZero, isNot(contains('}')));

          final resultOne = l10n.recruitT04TeamNeeded(1);
          expect(resultOne, isNotNull);
          expect(resultOne, isNot(contains('{')));
          expect(resultOne, isNot(contains('}')));

          final resultMultiple = l10n.recruitT04TeamNeeded(3);
          expect(resultMultiple, isNotNull);
          expect(resultMultiple, isNot(contains('{')));
          expect(resultMultiple, isNot(contains('}')));
        });

        test('recruitT05MilestoneReached should format all placeholders', () {
          final result = l10n.recruitT05MilestoneReached('María', 'NeoLife');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT06WelcomeOnboard should format all placeholders', () {
          final result = l10n.recruitT06WelcomeOnboard('María', 'Stephen', 'teambuildpro.com/join/abc123xyz');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('Stephen'));
          expect(result, contains('teambuildpro.com/join/abc123xyz'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT07WeeklyCheckIn should format all placeholders', () {
          final result = l10n.recruitT07WeeklyCheckIn('María', 'NeoLife');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT08Deadline should format plural correctly', () {
          final resultOne = l10n.recruitT08Deadline(1, 'tbp.app/abc123');
          expect(resultOne, isNotNull);
          expect(resultOne, contains('tbp.app/abc123'));
          expect(resultOne, isNot(contains('{')));
          expect(resultOne, isNot(contains('}')));

          final resultMultiple = l10n.recruitT08Deadline(3, 'tbp.app/abc123');
          expect(resultMultiple, isNotNull);
          expect(resultMultiple, contains('tbp.app/abc123'));
          expect(resultMultiple, isNot(contains('{')));
          expect(resultMultiple, isNot(contains('}')));
        });

        test('recruitT09ResourceShare should format all placeholders', () {
          final result = l10n.recruitT09ResourceShare('María', 'NeoLife', 'teambuildpro.com/join/abc123xyz');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, contains('teambuildpro.com/join/abc123xyz'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT10InviteReminder should format all placeholders', () {
          final result = l10n.recruitT10InviteReminder('María', 'NeoLife', 'tbp.app/abc123');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, contains('tbp.app/abc123'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT11TeamGrowth should format all placeholders', () {
          final result = l10n.recruitT11TeamGrowth('María', 'NeoLife');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT12Encouragement should format all placeholders', () {
          final result = l10n.recruitT12Encouragement('María', 'NeoLife');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT13TrainingInvite should format all placeholders', () {
          final result = l10n.recruitT13TrainingInvite('María', 'NeoLife', 'teambuildpro.com/join/abc123xyz');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, contains('teambuildpro.com/join/abc123xyz'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT14QuickWin should format all placeholders', () {
          final result = l10n.recruitT14QuickWin('María', 'NeoLife');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT15SupportOffer should format all placeholders', () {
          final result = l10n.recruitT15SupportOffer('María', 'NeoLife');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });

        test('recruitT16Gratitude should format all placeholders', () {
          final result = l10n.recruitT16Gratitude('María', 'NeoLife');

          expect(result, isNotNull);
          expect(result, isNotEmpty);
          expect(result, contains('María'));
          expect(result, contains('NeoLife'));
          expect(result, isNot(contains('{')));
          expect(result, isNot(contains('}')));
        });
      });
    }
  });
}
