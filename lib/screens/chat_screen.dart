import 'package:flutter/material.dart';
import '../widgets/localized_text.dart';

class ChatScreen extends StatelessWidget {
  const ChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Text(context.l10n?.chatTitle ?? 'Chat'),
      ),
      body: Center(child: Text(context.l10n?.chatPlaceholder ?? 'Chat interface goes here.')),
    );
  }
}
