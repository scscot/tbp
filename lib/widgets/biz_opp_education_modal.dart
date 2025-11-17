import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../config/app_colors.dart';
import '../l10n/app_localizations.dart';

Future<void> showBizOppEducationModal(
  BuildContext context,
  String userId,
  String bizOppName,
  VoidCallback onJoinNow,
) async {
  return showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => BizOppEducationModal(
      userId: userId,
      bizOppName: bizOppName,
      onJoinNow: onJoinNow,
    ),
  );
}

class BizOppEducationModal extends StatelessWidget {
  final String userId;
  final String bizOppName;
  final VoidCallback onJoinNow;

  const BizOppEducationModal({
    super.key,
    required this.userId,
    required this.bizOppName,
    required this.onJoinNow,
  });

  Future<void> _markAsShown(BuildContext context) async {
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .update({'bizOppEducationShown': true});
    } catch (e) {
      debugPrint('Error marking education modal as shown: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      child: Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.lightbulb_outline,
                  size: 40,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                AppLocalizations.of(context).bizOppEducationTitle,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.amber.withValues(alpha: 0.3),
                    width: 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.info_outline,
                          color: Colors.amber[700],
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            AppLocalizations.of(context).bizOppEducationWorksTitle,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.amber[900],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      AppLocalizations.of(context).bizOppEducationWorksBody(bizOppName),
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.check_circle_outline,
                          color: Colors.green[700],
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          AppLocalizations.of(context).bizOppEducationBenefitsTitle,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.green[900],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildBenefitRow(AppLocalizations.of(context).bizOppEducationBenefit1),
                    const SizedBox(height: 8),
                    _buildBenefitRow(AppLocalizations.of(context).bizOppEducationBenefit2),
                    const SizedBox(height: 8),
                    _buildBenefitRow(AppLocalizations.of(context).bizOppEducationBenefit3),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        await _markAsShown(context);
                        if (context.mounted) {
                          Navigator.of(context).pop();
                        }
                      },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        side: BorderSide(color: AppColors.textSecondary),
                      ),
                      child: Text(
                        AppLocalizations.of(context).bizOppEducationRemindLater,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: () async {
                        await _markAsShown(context);
                        if (context.mounted) {
                          Navigator.of(context).pop();
                          onJoinNow();
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 2,
                      ),
                      child: Text(
                        AppLocalizations.of(context).bizOppEducationJoinNow,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBenefitRow(String text) {
    return Row(
      children: [
        Icon(
          Icons.check,
          color: Colors.green[700],
          size: 18,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
