// lib/services/listener_manager.dart
import 'dart:async';

class ListenerManager {
  static final List<StreamSubscription> _subscriptions = [];

  static void add(StreamSubscription sub) {
    _subscriptions.add(sub);
  }

  static Future<void> cancelAll() async {
    for (final sub in _subscriptions) {
      await sub.cancel();
    }
    _subscriptions.clear();
  }
}
