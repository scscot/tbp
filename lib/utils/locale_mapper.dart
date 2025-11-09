class LocaleMapper {
  static String normalizeLocale(String code) {
    final normalized = code.toLowerCase().split('-')[0].split('_')[0];

    switch (normalized) {
      case 'en':
        return 'en';
      case 'es':
        return 'es';
      case 'pt':
        return 'pt';
      case 'tl':
      case 'fil':
        return 'tl';
      default:
        return 'en';
    }
  }

  static String toAppStoreCode(String appLocale) {
    const mapping = {
      'tl': 'fil',
      'pt': 'pt-BR',
      'es': 'es',
    };
    return mapping[appLocale] ?? appLocale;
  }

  static String toPlayStoreCode(String appLocale) {
    const mapping = {
      'tl': 'tl',
      'pt': 'pt-BR',
      'es': 'es-419',
    };
    return mapping[appLocale] ?? appLocale;
  }

  static bool isSupported(String localeCode) {
    return ['en', 'es', 'pt', 'tl'].contains(localeCode);
  }

  static String getDisplayName(String localeCode) {
    const names = {
      'en': 'English',
      'es': 'Español',
      'pt': 'Português',
      'tl': 'Tagalog',
    };
    return names[localeCode] ?? localeCode;
  }
}
