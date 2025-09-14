class ChatMessage {
  final String id;
  final String text;
  final bool isFromUser;
  final DateTime timestamp;
  final bool isStreaming;
  final bool isError;
  final Map<String, dynamic>? routeAction;

  const ChatMessage({
    required this.id,
    required this.text,
    required this.isFromUser,
    required this.timestamp,
    this.isStreaming = false,
    this.isError = false,
    this.routeAction,
  });

  ChatMessage copyWith({
    String? id,
    String? text,
    bool? isFromUser,
    DateTime? timestamp,
    bool? isStreaming,
    bool? isError,
    Map<String, dynamic>? routeAction,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      text: text ?? this.text,
      isFromUser: isFromUser ?? this.isFromUser,
      timestamp: timestamp ?? this.timestamp,
      isStreaming: isStreaming ?? this.isStreaming,
      isError: isError ?? this.isError,
      routeAction: routeAction ?? this.routeAction,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'text': text,
      'isFromUser': isFromUser,
      'timestamp': timestamp.toIso8601String(),
      'isStreaming': isStreaming,
      'isError': isError,
      'routeAction': routeAction,
    };
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      text: json['text'] as String,
      isFromUser: json['isFromUser'] as bool,
      timestamp: DateTime.parse(json['timestamp'] as String),
      isStreaming: json['isStreaming'] as bool? ?? false,
      isError: json['isError'] as bool? ?? false,
      routeAction: json['routeAction'] as Map<String, dynamic>?,
    );
  }
}