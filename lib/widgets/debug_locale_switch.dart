import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Debug-only widget for switching locales at runtime.
///
/// Only visible in debug/staging builds (!kReleaseMode).
/// Allows QA to test all supported locales without rebuilding.
///
/// **Usage in settings screen:**
/// ```dart
/// if (!kReleaseMode) {
///   DebugLocaleSwitch(),
/// }
/// ```
class DebugLocaleSwitch extends StatefulWidget {
  const DebugLocaleSwitch({super.key});

  @override
  State<DebugLocaleSwitch> createState() => _DebugLocaleSwitchState();
}

class _DebugLocaleSwitchState extends State<DebugLocaleSwitch> {
  static const supportedLocales = [
    Locale('en'),
    Locale('es'),
    Locale('pt'),
    Locale('tl'),
    Locale('en', 'XA'), // Pseudo-locale for i18n testing
  ];

  static const localeNames = {
    'en': 'English',
    'es': 'Español (Spanish)',
    'pt': 'Português (Portuguese)',
    'tl': 'Tagalog (Filipino)',
    'en_XA': 'Pseudo-locale (Testing)',
  };

  String _getLocaleKey(Locale locale) {
    if (locale.countryCode != null) {
      return '${locale.languageCode}_${locale.countryCode}';
    }
    return locale.languageCode;
  }

  String _getLocaleName(Locale locale) {
    final key = _getLocaleKey(locale);
    return localeNames[key] ?? key;
  }

  Locale? _getCurrentLocale() {
    final currentLocale = Localizations.localeOf(context);
    final key = _getLocaleKey(currentLocale);

    // Find matching supported locale
    for (final locale in supportedLocales) {
      if (_getLocaleKey(locale) == key) {
        return locale;
      }
    }

    return null;
  }

  void _setLocale(Locale? locale) {
    if (locale == null) return;

    // Find the root widget and trigger a locale change
    // This requires the app to be wrapped in a Localizations widget
    // that supports locale changing via InheritedWidget or Provider

    // For now, show a dialog explaining how to change locale
    // In a full implementation, this would use a state management solution
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Locale Switch'),
        content: Text(
          'Selected: ${_getLocaleName(locale)}\n\n'
          'To fully switch locale, restart the app with:\n'
          'flutter run --dart-define=LOCALE=${_getLocaleKey(locale)}',
        ),
        actions: [
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
    // Only show in debug/staging builds
    if (kReleaseMode) {
      return const SizedBox.shrink();
    }

    final currentLocale = _getCurrentLocale();

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.amber[50], // Yellow tint to indicate debug feature
      child: ListTile(
        leading: const Icon(Icons.language, color: Colors.amber),
        title: const Text(
          'Debug: Locale Switch',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          currentLocale != null
              ? 'Current: ${_getLocaleName(currentLocale)}'
              : 'Current: System default',
        ),
        trailing: DropdownButton<Locale>(
          value: currentLocale,
          hint: const Text('Select locale'),
          onChanged: _setLocale,
          items: supportedLocales.map((locale) {
            return DropdownMenuItem(
              value: locale,
              child: Text(_getLocaleName(locale)),
            );
          }).toList(),
        ),
      ),
    );
  }
}

/// Extension to make locale switching easier.
///
/// **Usage:**
/// ```dart
/// // In your main.dart MaterialApp:
/// locale: AppLocale.currentLocale,
///
/// // To change locale:
/// AppLocale.setLocale(context, Locale('es'));
/// ```
class AppLocale {
  static Locale? _overrideLocale;

  /// Get the current locale override, or null to use system locale
  static Locale? get currentLocale => _overrideLocale;

  /// Set the app locale at runtime (debug/staging only)
  static void setLocale(BuildContext context, Locale locale) {
    if (kReleaseMode) return; // Prevent locale switching in production

    _overrideLocale = locale;

    // Trigger app rebuild with new locale
    // This requires RestartWidget or similar mechanism
    // For Team Build Pro, this would integrate with RestartWidget
  }

  /// Reset to system locale
  static void resetLocale(BuildContext context) {
    if (kReleaseMode) return;

    _overrideLocale = null;
    // Trigger app rebuild
  }
}
