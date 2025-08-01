// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';

/// Team Build Pro App Color Palette
/// A professional, modern color system designed for trust, growth, and success
class AppColors {
  // Private constructor to prevent instantiation
  AppColors._();

  // ============================================================================
  // PRIMARY BRAND COLORS
  // ============================================================================

  /// Primary brand color - Professional blue for trust and reliability
  static const Color primary = Color(0xFF2563EB); // Blue 600
  static const Color primaryLight = Color(0xFF3B82F6); // Blue 500
  static const Color primaryDark = Color(0xFF1D4ED8); // Blue 700
  static const Color primaryExtraLight = Color(0xFFDBEAFE); // Blue 100

  /// Secondary brand color - Success green for growth and achievement
  static const Color secondary = Color(0xFF059669); // Emerald 600
  static const Color secondaryLight = Color(0xFF10B981); // Emerald 500
  static const Color secondaryDark = Color(0xFF047857); // Emerald 700
  static const Color secondaryExtraLight = Color(0xFFD1FAE5); // Emerald 100

  // ============================================================================
  // FUNCTIONAL COLORS
  // ============================================================================

  /// Success states - Green palette for positive actions
  static const Color success = Color(0xFF059669); // Emerald 600
  static const Color successLight = Color(0xFF10B981); // Emerald 500
  static const Color successBackground = Color(0xFFECFDF5); // Emerald 50

  /// Warning states - Amber palette for caution
  static const Color warning = Color(0xFFD97706); // Amber 600
  static const Color warningLight = Color(0xFFF59E0B); // Amber 500
  static const Color warningBackground = Color(0xFFFFFBEB); // Amber 50

  /// Error states - Red palette for errors and alerts
  static const Color error = Color(0xFFDC2626); // Red 600
  static const Color errorLight = Color(0xFFEF4444); // Red 500
  static const Color errorBackground = Color(0xFFFEF2F2); // Red 50

  /// Info states - Blue palette for information
  static const Color info = Color(0xFF2563EB); // Blue 600
  static const Color infoLight = Color(0xFF3B82F6); // Blue 500
  static const Color infoBackground = Color(0xFFEFF6FF); // Blue 50

  // ============================================================================
  // NEUTRAL COLORS
  // ============================================================================

  /// Text colors
  static const Color textPrimary = Color(0xFF111827); // Gray 900
  static const Color textSecondary = Color(0xFF6B7280); // Gray 500
  static const Color textTertiary = Color(0xFF9CA3AF); // Gray 400
  static const Color textInverse = Color(0xFFFFFFFF); // White

  /// Background colors
  static const Color backgroundPrimary = Color(0xFFFFFFFF); // White
  static const Color backgroundSecondary = Color(0xFFF9FAFB); // Gray 50
  static const Color backgroundTertiary = Color(0xFFF3F4F6); // Gray 100

  /// Surface colors
  static const Color surface = Color(0xFFFFFFFF); // White
  static const Color surfaceElevated =
      Color(0xFFFFFFFF); // White with elevation

  /// Border colors
  static const Color border = Color(0xFFE5E7EB); // Gray 200
  static const Color borderLight = Color(0xFFF3F4F6); // Gray 100
  static const Color borderDark = Color(0xFFD1D5DB); // Gray 300

  // ============================================================================
  // FEATURE-SPECIFIC COLORS
  // ============================================================================

  /// Team building colors
  static const Color teamPrimary = Color(0xFF3B82F6); // Blue 500
  static const Color teamSecondary = Color(0xFF10B981); // Emerald 500
  static const Color teamAccent = Color(0xFF8B5CF6); // Violet 500

  /// Growth and progress colors
  static const Color growthPrimary = Color(0xFF059669); // Emerald 600
  static const Color growthSecondary = Color(0xFF0891B2); // Cyan 600
  static const Color growthAccent = Color(0xFFF59E0B); // Amber 500

  /// Opportunity colors
  static const Color opportunityPrimary = Color(0xFFF59E0B); // Amber 500
  static const Color opportunitySecondary = Color(0xFFEA580C); // Orange 600
  static const Color opportunityAccent = Color(0xFFDC2626); // Red 600

  /// Communication colors
  static const Color messagePrimary = Color(0xFFEA580C); // Orange 600
  static const Color messageSecondary = Color(0xFFF97316); // Orange 500
  static const Color notificationPrimary = Color(0xFFDC2626); // Red 600
  static const Color notificationSecondary = Color(0xFFEF4444); // Red 500

  // ============================================================================
  // GRADIENT DEFINITIONS
  // ============================================================================

  /// Primary gradient for hero sections and key CTAs
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF3B82F6), // Blue 500
      Color(0xFF1D4ED8), // Blue 700
      Color(0xFF7C3AED), // Violet 600
    ],
  );

  /// Success gradient for positive actions
  static const LinearGradient successGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF10B981), // Emerald 500
      Color(0xFF059669), // Emerald 600
    ],
  );

  /// Warning gradient for attention-grabbing elements
  static const LinearGradient warningGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFF59E0B), // Amber 500
      Color(0xFFEA580C), // Orange 600
    ],
  );

  /// Growth gradient for progress indicators
  static const LinearGradient growthGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF059669), // Emerald 600
      Color(0xFF0891B2), // Cyan 600
    ],
  );

  // ============================================================================
  // SHADOW DEFINITIONS
  // ============================================================================

  /// Light shadow for subtle elevation
  static List<BoxShadow> lightShadow = [
    BoxShadow(
      color: const Color(0xFF000000).withOpacity(0.05),
      blurRadius: 4,
      offset: const Offset(0, 2),
    ),
  ];

  /// Medium shadow for cards and elevated elements
  static List<BoxShadow> mediumShadow = [
    BoxShadow(
      color: const Color(0xFF000000).withOpacity(0.1),
      blurRadius: 8,
      offset: const Offset(0, 4),
    ),
  ];

  /// Heavy shadow for modals and floating elements
  static List<BoxShadow> heavyShadow = [
    BoxShadow(
      color: const Color(0xFF000000).withOpacity(0.15),
      blurRadius: 16,
      offset: const Offset(0, 8),
    ),
  ];

  // ============================================================================
  // LEGACY SUPPORT (for gradual migration)
  // ============================================================================

  /// Legacy header color - will be phased out
  @Deprecated('Use AppColors.backgroundSecondary instead')
  static const Color legacyHeaderBackground = Color(0xFFE6E6FA);

  /// Helper method to get color with opacity
  static Color withOpacity(Color color, double opacity) {
    return color.withOpacity(opacity);
  }

  /// Helper method to get lighter shade of a color
  static Color lighter(Color color, [double amount = 0.1]) {
    return Color.lerp(color, Colors.white, amount) ?? color;
  }

  /// Helper method to get darker shade of a color
  static Color darker(Color color, [double amount = 0.1]) {
    return Color.lerp(color, Colors.black, amount) ?? color;
  }
}

/// Extension to add convenience methods to Color class
extension AppColorExtensions on Color {
  /// Get a lighter shade of this color
  Color get lighter => AppColors.lighter(this);

  /// Get a darker shade of this color
  Color get darker => AppColors.darker(this);

  /// Get this color with specified opacity
  Color opacity(double opacity) => withOpacity(opacity);
}
