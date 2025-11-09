class AuthErrorCodes {
  static const Map<String, String> firebaseToKey = {
    'auth/invalid-email': 'authErrorInvalidEmail',
    'auth/user-disabled': 'authErrorUserDisabled',
    'auth/user-not-found': 'authErrorUserNotFound',
    'auth/wrong-password': 'authErrorWrongPassword',
    'auth/email-already-in-use': 'authErrorEmailInUse',
    'auth/weak-password': 'authErrorWeakPassword',
    'auth/network-request-failed': 'authErrorNetworkError',
    'auth/too-many-requests': 'authErrorTooMany',
    'auth/invalid-credential': 'authErrorInvalidCredential',
  };

  static String getLocalizationKey(String firebaseCode) {
    return firebaseToKey[firebaseCode] ?? 'authErrorUnknown';
  }
}
