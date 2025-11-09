import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';

/// A debug-friendly Text widget that displays missing translations in red.
///
/// In debug/staging builds (!kReleaseMode), shows `[MISSING: keyName]` in red
/// when a localization lookup fails. In production (kReleaseMode), silently
/// falls back to an empty string.
///
/// Usage:
/// ```dart
/// LocalizedText((l10n) => l10n.authLoginHeaderTitle)
/// ```
class LocalizedText extends StatelessWidget {
  /// Function that accesses the localized string from AppLocalizations
  final String Function(AppLocalizations) builder;

  /// Optional text style
  final TextStyle? style;

  /// Optional text alignment
  final TextAlign? textAlign;

  /// Optional max lines
  final int? maxLines;

  /// Optional overflow behavior
  final TextOverflow? overflow;

  const LocalizedText(
    this.builder, {
    super.key,
    this.style,
    this.textAlign,
    this.maxLines,
    this.overflow,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    // Try to get the localized string
    try {
      final text = builder(l10n);
      return Text(
        text,
        style: style,
        textAlign: textAlign,
        maxLines: maxLines,
        overflow: overflow,
      );
    } catch (e) {
      if (kReleaseMode) {
        // Production: Silent fail with empty string
        return Text(
          '',
          style: style,
          textAlign: textAlign,
          maxLines: maxLines,
          overflow: overflow,
        );
      } else {
        // Debug/staging: Show error in red
        return Text(
          '[MISSING: ${e.toString()}]',
          style: const TextStyle(
            color: Colors.red,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ).merge(style),
          textAlign: textAlign,
          maxLines: maxLines,
          overflow: overflow,
        );
      }
    }
  }
}

/// Extension to provide convenient access to localized strings
///
/// Usage:
/// ```dart
/// context.l10n.authLoginHeaderTitle
/// ```
extension LocalizationExtension on BuildContext {
  AppLocalizations? get l10n => AppLocalizations.of(this);
}
