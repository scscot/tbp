import 'package:flutter/material.dart';
import '../config/app_colors.dart';
import '../l10n/app_localizations.dart';

class QuickPromptsWidget extends StatelessWidget {
  final List<String> prompts;
  final Function(String) onPromptSelected;

  const QuickPromptsWidget({
    super.key,
    required this.prompts,
    required this.onPromptSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 20),
          
          // Welcome message
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.smart_toy, color: AppColors.primary, size: 24),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        AppLocalizations.of(context).quickPromptsWelcomeTitle,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.visible,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  AppLocalizations.of(context).quickPromptsWelcomeDescription,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey.shade700,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.grey.shade300, width: 0.5),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, 
                           color: Colors.grey.shade600, 
                           size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          AppLocalizations.of(context).quickPromptsDisclaimerMessage,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade700,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Quick start prompts header
          Text(
            AppLocalizations.of(context).quickPromptsQuestionHeader,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 4),

          Text(
            AppLocalizations.of(context).quickPromptsQuestionSubheader,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade600,
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Quick prompt cards
          ...prompts.map((prompt) => _buildPromptCard(prompt)),
          
          const SizedBox(height: 20),
          
          // Additional help
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(Icons.lightbulb_outline, color: Colors.orange.shade600),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        AppLocalizations.of(context).quickPromptsProTipLabel,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Text(
                        AppLocalizations.of(context).quickPromptsProTipText,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPromptCard(String prompt) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: Colors.grey.shade300),
        ),
        child: InkWell(
          onTap: () => onPromptSelected(prompt),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(
                  _getIconForPrompt(prompt),
                  color: AppColors.primary,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    prompt,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios,
                  color: Colors.grey.shade400,
                  size: 16,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getIconForPrompt(String prompt) {
    final lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.contains('qualification')) {
      return Icons.check_circle_outline;
    } else if (lowerPrompt.contains('mlm') || lowerPrompt.contains('difference')) {
      return Icons.info_outline;
    } else if (lowerPrompt.contains('invite') || lowerPrompt.contains('people')) {
      return Icons.person_add_outlined;
    } else if (lowerPrompt.contains('analytics') || lowerPrompt.contains('team')) {
      return Icons.analytics_outlined;
    } else if (lowerPrompt.contains('focus') || lowerPrompt.contains('next')) {
      return Icons.flag_outlined;
    } else if (lowerPrompt.contains('cancel') || lowerPrompt.contains('subscription')) {
      return Icons.credit_card_outlined;
    } else if (lowerPrompt.contains('fail') || lowerPrompt.contains('why')) {
      return Icons.psychology_outlined;
    } else if (lowerPrompt.contains('long') || lowerPrompt.contains('time')) {
      return Icons.schedule_outlined;
    } else {
      return Icons.help_outline;
    }
  }
}