import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/chat_message.dart';

class ChatBotService {
  static const String _baseUrl = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/chatbot';
  
  // Stream controller for real-time messages
  final StreamController<ChatMessage> _messageController = StreamController<ChatMessage>.broadcast();
  Stream<ChatMessage> get messageStream => _messageController.stream;
  
  // Current conversation state
  final List<ChatMessage> _messages = [];
  List<ChatMessage> get messages => List.unmodifiable(_messages);
  
  String? _currentThreadId;
  bool _isStreaming = false;
  
  Future<void> sendMessage(String message, String userId) async {
    if (_isStreaming) {
      debugPrint('⚠️ CHATBOT_SERVICE: Already streaming, ignoring new message');
      return;
    }
    
    try {
      _isStreaming = true;
      
      // Add user message immediately
      final userMessage = ChatMessage(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        text: message,
        isFromUser: true,
        timestamp: DateTime.now(),
      );
      
      _addMessage(userMessage);
      
      // Create bot message placeholder
      final botMessage = ChatMessage(
        id: '${DateTime.now().millisecondsSinceEpoch}_bot',
        text: '',
        isFromUser: false,
        timestamp: DateTime.now(),
        isStreaming: true,
      );
      
      _addMessage(botMessage);
      
      // Start streaming request
      await _streamResponse(message, userId, botMessage.id);
      
    } catch (e) {
      debugPrint('❌ CHATBOT_SERVICE: Error sending message - $e');
      _addErrorMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      _isStreaming = false;
    }
  }
  
  Future<void> _streamResponse(String message, String userId, String botMessageId) async {
    try {
      _currentThreadId ??= DateTime.now().millisecondsSinceEpoch.toString();
      
      final request = http.Request('POST', Uri.parse(_baseUrl));
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode({
        'message': message,
        'userId': userId,
        'threadId': _currentThreadId,
      });
      
      final response = await http.Client().send(request);
      
      if (response.statusCode != 200) {
        throw Exception('Server returned ${response.statusCode}');
      }
      
      String accumulatedText = '';
      
      await for (String chunk in response.stream.transform(utf8.decoder)) {
        final lines = chunk.split('\n');
        
        for (String line in lines) {
          if (line.startsWith('data: ')) {
            try {
              final data = jsonDecode(line.substring(6));
              
              switch (data['type']) {
                case 'content':
                  accumulatedText += data['data'] as String;
                  _updateMessage(botMessageId, accumulatedText, isStreaming: true);
                  break;
                  
                case 'done':
                  _updateMessage(botMessageId, accumulatedText, isStreaming: false);
                  debugPrint('✅ CHATBOT_SERVICE: Response completed, tokens used: ${data['tokens']}');
                  
                  // Check for route actions in the final text and clean the display text
                  debugPrint('🔍 CHATBOT_SERVICE: Final response text: $accumulatedText');
                  final extractionResult = _extractAndCleanRouteAction(accumulatedText);
                  final cleanedText = extractionResult['cleanedText'] as String;
                  final routeAction = extractionResult['routeAction'] as Map<String, dynamic>?;
                  
                  if (routeAction != null) {
                    debugPrint('✅ CHATBOT_SERVICE: Route action found: $routeAction');
                    debugPrint('🧹 CHATBOT_SERVICE: Cleaned text: $cleanedText');
                    _updateMessage(botMessageId, cleanedText, 
                      isStreaming: false, routeAction: routeAction);
                  } else {
                    debugPrint('❌ CHATBOT_SERVICE: No route action found in response');
                    _updateMessage(botMessageId, cleanedText, isStreaming: false);
                  }
                  break;
                  
                case 'error':
                  _updateMessage(botMessageId, data['message'] as String, isStreaming: false, isError: true);
                  break;
              }
            } catch (e) {
              debugPrint('⚠️ CHATBOT_SERVICE: Error parsing chunk: $e');
            }
          }
        }
      }
      
    } catch (e) {
      debugPrint('❌ CHATBOT_SERVICE: Streaming error - $e');
      _updateMessage(botMessageId, 'Sorry, I encountered an error. Please try again.', 
        isStreaming: false, isError: true);
    }
  }
  
  Map<String, dynamic> _extractAndCleanRouteAction(String text) {
    try {
      // Pattern to match JSON route actions - more comprehensive patterns
      final jsonPatterns = [
        // Complete JSON: {"action": {"route": "/team", "params": {}}}
        RegExp(r'\s*\{\s*"action"\s*:\s*\{\s*"route"\s*:\s*"([^"]+)"\s*,\s*"params"\s*:\s*\{[^}]*\}\s*\}\s*\}'),
        // Partial JSON: {"action": {"route": "/team"
        RegExp(r'\s*\{\s*"action"\s*:\s*\{\s*"route"\s*:\s*"([^"]+)"[^}]*'),
        // Simple route pattern: "route": "/team"
        RegExp(r'\s*"route"\s*:\s*"([^"]+)"[^}]*'),
      ];
      
      String cleanedText = text.trim();
      Map<String, dynamic>? routeAction;
      
      for (final pattern in jsonPatterns) {
        final match = pattern.firstMatch(cleanedText);
        if (match != null) {
          final route = match.group(1);
          if (route != null) {
            // Remove the JSON from the display text
            cleanedText = cleanedText.replaceAll(pattern, '').trim();
            
            // Remove any trailing periods, commas, or extra whitespace after JSON removal
            cleanedText = cleanedText.replaceAll(RegExp(r'[.,]\s*$'), '').trim();
            
            // Construct the route action object
            routeAction = {
              'action': {
                'route': route,
                'params': {}
              }
            };
            
            debugPrint('🔧 CHATBOT_SERVICE: Extracted route: $route');
            debugPrint('🧹 CHATBOT_SERVICE: Removed JSON from text');
            break;
          }
        }
      }
      
      return {
        'cleanedText': cleanedText,
        'routeAction': routeAction,
      };
      
    } catch (e) {
      debugPrint('⚠️ CHATBOT_SERVICE: Error extracting and cleaning route action: $e');
      return {
        'cleanedText': text,
        'routeAction': null,
      };
    }
  }
  
  void _addMessage(ChatMessage message) {
    _messages.add(message);
    _messageController.add(message);
  }
  
  void _updateMessage(String messageId, String text, {
    required bool isStreaming,
    bool isError = false,
    Map<String, dynamic>? routeAction,
  }) {
    final index = _messages.indexWhere((m) => m.id == messageId);
    if (index != -1) {
      final updatedMessage = _messages[index].copyWith(
        text: text,
        isStreaming: isStreaming,
        isError: isError,
        routeAction: routeAction,
      );
      
      _messages[index] = updatedMessage;
      _messageController.add(updatedMessage);
    }
  }
  
  void _addErrorMessage(String error) {
    final errorMessage = ChatMessage(
      id: '${DateTime.now().millisecondsSinceEpoch}_error',
      text: error,
      isFromUser: false,
      timestamp: DateTime.now(),
      isError: true,
    );
    
    _addMessage(errorMessage);
  }
  
  void clearConversation() {
    _messages.clear();
    _currentThreadId = null;
    debugPrint('🧹 CHATBOT_SERVICE: Conversation cleared');
  }
  
  List<String> getQuickStartPrompts() {
    return [
      "How does qualification work?",
      "What's the difference between this and an MLM?",
      "How do I invite people to my team?",
      "Show me my team analytics",
      "What should I focus on next?",
      "How do I cancel my subscription?",
      "Why do most people fail at direct sales?",
      "What are the qualification requirements?",
    ];
  }
  
  void dispose() {
    _messageController.close();
  }
}