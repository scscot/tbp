import 'package:flutter/material.dart';
import '../config/app_colors.dart';
import '../models/chat_message.dart';

class ChatBubble extends StatelessWidget {
  final ChatMessage message;
  final Function(Map<String, dynamic>?)? onRouteAction;

  const ChatBubble({
    super.key,
    required this.message,
    this.onRouteAction,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: 
            message.isFromUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!message.isFromUser) ...[
            CircleAvatar(
              backgroundColor: AppColors.primary,
              radius: 16,
              child: const Icon(Icons.smart_toy, color: Colors.white, size: 16),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: message.isFromUser 
                    ? AppColors.primary 
                    : message.isError 
                        ? Colors.red.shade50 
                        : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(18),
                border: message.isError 
                    ? Border.all(color: Colors.red.shade300, width: 1)
                    : null,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.text,
                    style: TextStyle(
                      color: message.isFromUser 
                          ? Colors.white 
                          : message.isError 
                              ? Colors.red.shade700 
                              : Colors.black87,
                      fontSize: 16,
                    ),
                  ),
                  if (message.isStreaming) ...[
                    const SizedBox(height: 8),
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          message.isFromUser ? Colors.white70 : AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                  if (message.routeAction != null && !message.isFromUser) ...[
                    const SizedBox(height: 8),
                    _buildActionButton(context),
                  ],
                ],
              ),
            ),
          ),
          if (message.isFromUser) ...[
            const SizedBox(width: 8),
            CircleAvatar(
              backgroundColor: Colors.grey.shade300,
              radius: 16,
              child: const Icon(Icons.person, color: Colors.white, size: 16),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActionButton(BuildContext context) {
    if (message.routeAction == null) return const SizedBox.shrink();
    
    try {
      final action = message.routeAction!['action'] as Map<String, dynamic>;
      final route = action['route'] as String;
      
      String buttonText;
      IconData buttonIcon;
      
      switch (route) {
        case '/team':
          buttonText = 'View Your Team';
          buttonIcon = Icons.people;
          break;
        case '/grow':
          buttonText = 'Grow Your Team';
          buttonIcon = Icons.trending_up;
          break;
        case '/messages':
          buttonText = 'View Messages';
          buttonIcon = Icons.message;
          break;
        case '/dashboard':
        case '/home':
          buttonText = 'Go to Dashboard';
          buttonIcon = Icons.home;
          break;
        default:
          buttonText = 'Go to ${route.substring(1)}';
          buttonIcon = Icons.arrow_forward;
      }
      
      return OutlinedButton.icon(
        onPressed: () => onRouteAction?.call(message.routeAction),
        icon: Icon(buttonIcon, size: 16),
        label: Text(buttonText),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: BorderSide(color: AppColors.primary),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        ),
      );
    } catch (e) {
      debugPrint('❌ Error building action button: $e');
      return const SizedBox.shrink();
    }
  }
}