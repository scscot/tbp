import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_colors.dart';
import '../services/auth_service.dart';
import '../services/chatbot_service.dart';
import '../models/chat_message.dart';
import '../widgets/chat_bubble.dart';
import '../widgets/quick_prompts_widget.dart';

class ChatBotScreen extends StatefulWidget {
  final void Function(int)? onTabSelected;
  
  const ChatBotScreen({super.key, this.onTabSelected});

  @override
  State<ChatBotScreen> createState() => _ChatBotScreenState();
}

class _ChatBotScreenState extends State<ChatBotScreen> {
  late final ChatBotService _chatService;
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  late final Stream<ChatMessage> _messageStream;
  
  bool _isInitialized = false;
  bool _showQuickPrompts = true;

  @override
  void initState() {
    super.initState();
    _initializeChatService();
  }

  void _initializeChatService() {
    _chatService = ChatBotService();
    _messageStream = _chatService.messageStream;
    
    // Listen to messages to auto-scroll
    _messageStream.listen((message) {
      if (mounted) {
        setState(() {
          _showQuickPrompts = _chatService.messages.isEmpty;
        });
        _scrollToBottom();
      }
    });
    
    _isInitialized = true;
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty || !_isInitialized) return;
    
    final authService = context.read<AuthService>();
    // Get current user from the user stream
    final userStream = authService.user;
    final currentUser = await userStream.first;
    
    if (currentUser == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please sign in to use the AI Assistant')),
        );
      }
      return;
    }

    _messageController.clear();
    setState(() {
      _showQuickPrompts = false;
    });

    await _chatService.sendMessage(text, currentUser.uid);
    _scrollToBottom();
  }

  void _handleQuickPrompt(String prompt) {
    _sendMessage(prompt);
  }

  void _handleRouteAction(Map<String, dynamic>? routeAction) {
    if (routeAction == null) return;
    
    try {
      final action = routeAction['action'] as Map<String, dynamic>;
      final route = action['route'] as String;
      // params could be used for future route parameter passing
      // final params = action['params'] as Map<String, dynamic>? ?? {};
      
      // Handle navigation to actual app tabs
      switch (route) {
        case '/team':
          // Team/Network tab - where team data and analytics are shown
          widget.onTabSelected?.call(1);
          Navigator.pop(context);
          break;
        case '/grow':
          // Grow/Share tab - for team building and invitations  
          widget.onTabSelected?.call(2);
          Navigator.pop(context);
          break;
        case '/messages':
          // Messages tab
          widget.onTabSelected?.call(3);
          Navigator.pop(context);
          break;
        case '/dashboard':
        case '/home':
          // Home/Dashboard tab
          widget.onTabSelected?.call(0);
          Navigator.pop(context);
          break;
        default:
          debugPrint('⚠️ Unknown route action: $route');
      }
    } catch (e) {
      debugPrint('❌ Error handling route action: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.smart_toy, size: 24),
            SizedBox(width: 8),
            Text('AI Coach'),
          ],
        ),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              _chatService.clearConversation();
              setState(() {
                _showQuickPrompts = true;
              });
            },
            tooltip: 'Clear conversation',
          ),
        ],
      ),
      body: Column(
        children: [
          _buildChatHeader(),
          Expanded(
            child: _showQuickPrompts ? _buildQuickPromptsView() : _buildChatView(),
          ),
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildChatHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        border: Border(bottom: BorderSide(color: Colors.grey.shade300)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: AppColors.primary,
            radius: 20,
            child: const Icon(Icons.smart_toy, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'AI Assistant',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                Text(
                  'Ask me anything about Team Build Pro',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickPromptsView() {
    return QuickPromptsWidget(
      prompts: _chatService.getQuickStartPrompts(),
      onPromptSelected: _handleQuickPrompt,
    );
  }

  Widget _buildChatView() {
    return StreamBuilder<ChatMessage>(
      stream: _messageStream,
      builder: (context, snapshot) {
        return ListView.builder(
          controller: _scrollController,
          padding: const EdgeInsets.all(16),
          itemCount: _chatService.messages.length,
          itemBuilder: (context, index) {
            final message = _chatService.messages[index];
            return ChatBubble(
              message: message,
              onRouteAction: _handleRouteAction,
            );
          },
        );
      },
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade300)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _messageController,
              decoration: InputDecoration(
                hintText: 'Ask me anything...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(25),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(25),
                  borderSide: BorderSide(color: AppColors.primary),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                suffixIcon: IconButton(
                  icon: Icon(Icons.send, color: AppColors.primary),
                  onPressed: () => _sendMessage(_messageController.text),
                ),
              ),
              maxLines: null,
              textInputAction: TextInputAction.send,
              onSubmitted: _sendMessage,
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _chatService.dispose();
    super.dispose();
  }
}