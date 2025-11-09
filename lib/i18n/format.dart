import 'package:intl/intl.dart';
import 'package:flutter/material.dart';

class AppFormat {
  static String formatDate(DateTime date, Locale locale,
      {String pattern = 'medium'}) {
    final String localeCode = locale.toString();

    switch (pattern) {
      case 'short':
        return DateFormat.yMd(localeCode).format(date);
      case 'medium':
        return DateFormat.yMMMd(localeCode).format(date);
      case 'long':
        return DateFormat.yMMMMd(localeCode).format(date);
      case 'full':
        return DateFormat.yMMMMEEEEd(localeCode).format(date);
      case 'time':
        return DateFormat.jm(localeCode).format(date);
      case 'datetime':
        return DateFormat.yMMMd(localeCode).add_jm().format(date);
      default:
        return DateFormat.yMMMd(localeCode).format(date);
    }
  }

  static String formatNumber(num number, Locale locale,
      {int? decimalDigits}) {
    final String localeCode = locale.toString();
    final formatter = NumberFormat.decimalPattern(localeCode);

    if (decimalDigits != null) {
      formatter.minimumFractionDigits = decimalDigits;
      formatter.maximumFractionDigits = decimalDigits;
    }

    return formatter.format(number);
  }

  static String formatCurrency(num amount, Locale locale,
      {String currencySymbol = '\$', int decimalDigits = 2}) {
    final String localeCode = locale.toString();
    final formatter = NumberFormat.currency(
      locale: localeCode,
      symbol: currencySymbol,
      decimalDigits: decimalDigits,
    );

    return formatter.format(amount);
  }

  static String formatPercent(num value, Locale locale,
      {int decimalDigits = 0}) {
    final String localeCode = locale.toString();
    final formatter = NumberFormat.percentPattern(localeCode);
    formatter.minimumFractionDigits = decimalDigits;
    formatter.maximumFractionDigits = decimalDigits;

    return formatter.format(value);
  }

  static String formatRelativeTime(DateTime dateTime, Locale locale,
      {DateTime? relativeTo}) {
    final now = relativeTo ?? DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 365) {
      final years = (difference.inDays / 365).floor();
      return years == 1 ? '1 year ago' : '$years years ago';
    } else if (difference.inDays > 30) {
      final months = (difference.inDays / 30).floor();
      return months == 1 ? '1 month ago' : '$months months ago';
    } else if (difference.inDays > 0) {
      return difference.inDays == 1
          ? '1 day ago'
          : '${difference.inDays} days ago';
    } else if (difference.inHours > 0) {
      return difference.inHours == 1
          ? '1 hour ago'
          : '${difference.inHours} hours ago';
    } else if (difference.inMinutes > 0) {
      return difference.inMinutes == 1
          ? '1 minute ago'
          : '${difference.inMinutes} minutes ago';
    } else {
      return 'Just now';
    }
  }

  static String formatCompactNumber(num number, Locale locale) {
    final String localeCode = locale.toString();

    if (number >= 1000000) {
      return '${(number / 1000000).toStringAsFixed(1)}M';
    } else if (number >= 1000) {
      return '${(number / 1000).toStringAsFixed(1)}K';
    } else {
      return NumberFormat.decimalPattern(localeCode).format(number);
    }
  }

  static String formatDuration(Duration duration, Locale locale) {
    if (duration.inDays > 0) {
      return duration.inDays == 1
          ? '1 day'
          : '${duration.inDays} days';
    } else if (duration.inHours > 0) {
      return duration.inHours == 1
          ? '1 hour'
          : '${duration.inHours} hours';
    } else if (duration.inMinutes > 0) {
      return duration.inMinutes == 1
          ? '1 minute'
          : '${duration.inMinutes} minutes';
    } else {
      return duration.inSeconds == 1
          ? '1 second'
          : '${duration.inSeconds} seconds';
    }
  }

  static String formatFileSize(int bytes, Locale locale) {
    if (bytes >= 1073741824) {
      return '${(bytes / 1073741824).toStringAsFixed(1)} GB';
    } else if (bytes >= 1048576) {
      return '${(bytes / 1048576).toStringAsFixed(1)} MB';
    } else if (bytes >= 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    } else {
      return '$bytes B';
    }
  }
}
