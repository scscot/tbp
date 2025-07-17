// ignore_for_file: unnecessary_cast

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../widgets/header_widgets.dart';
import '../models/user_model.dart';
import 'join_opportunity_screen.dart';
import 'package:flutter/foundation.dart' show kDebugMode;

class VisitOpportunityScreen extends StatefulWidget {
  final String appId;

  const VisitOpportunityScreen({
    super.key,
    required this.appId,
  });

  @override
  State<VisitOpportunityScreen> createState() => _VisitOpportunityScreenState();
}

class _VisitOpportunityScreenState extends State<VisitOpportunityScreen> {
  String? bizOpp;
  String? bizOppRefUrl;
  String? sponsorName;
  bool loading = true;
  bool hasVisitedOpp = false;
  DateTime? bizJoinDate;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null) {
      if (mounted) setState(() => loading = false);
      return;
    }

    final adminUid = user.uplineAdmin;
    if (adminUid == null || adminUid.isEmpty) {
      debugPrint("User does not have an upline admin.");
      if (mounted) setState(() => loading = false);
      return;
    }

    try {
      // Fetch biz_opp from admin_settings (following member_detail_screen pattern)
      final adminSettingsDoc = await FirebaseFirestore.instance
          .collection('admin_settings')
          .doc(adminUid)
          .get();
      
      String? retrievedBizOpp;
      if (adminSettingsDoc.exists) {
        final adminData = adminSettingsDoc.data() as Map<String, dynamic>?;
        retrievedBizOpp = adminData?['biz_opp'] as String?;
      }

      // Fetch bizOppRefUrl by traversing upline_refs
      String? retrievedBizOppRefUrl;
      if (user.uplineRefs != null && user.uplineRefs!.isNotEmpty) {
        retrievedBizOppRefUrl = await _findBizOppRefUrlInUpline(user.uplineRefs!);
      }

      // Fetch admin user data for sponsor name
      final adminUserDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(adminUid)
          .get();

      if (!mounted) return;

      String? retrievedSponsorName;
      if (adminUserDoc.exists) {
        final adminUserData = UserModel.fromFirestore(adminUserDoc);
        retrievedSponsorName =
            '${adminUserData.firstName ?? ''} ${adminUserData.lastName ?? ''}'
                .trim();
      }

      setState(() {
        bizOpp = retrievedBizOpp;
        bizOppRefUrl = retrievedBizOppRefUrl;
        sponsorName = retrievedSponsorName;
        hasVisitedOpp = user.bizVisitDate != null;
        bizJoinDate = user.bizVisitDate;
        loading = false;
      });

    } catch (e) {
      debugPrint('Error loading opportunity data: $e');
      if (mounted) setState(() => loading = false);
    }
  }

  Future<String?> _findBizOppRefUrlInUpline(List<String> uplineRefs) async {
    try {
      // Traverse upline_refs to find first user with non-null biz_opp_ref_url
      for (String uplineUid in uplineRefs) {
        final uplineUserDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(uplineUid)
            .get();
        
        if (uplineUserDoc.exists) {
          final uplineUserData = uplineUserDoc.data() as Map<String, dynamic>?;
          final bizOppRefUrl = uplineUserData?['biz_opp_ref_url'] as String?;
          
          if (bizOppRefUrl != null && bizOppRefUrl.isNotEmpty) {
            debugPrint('Found biz_opp_ref_url in upline user: $uplineUid');
            return bizOppRefUrl;
          }
        }
      }
      
      debugPrint('No biz_opp_ref_url found in upline chain');
      return null;
    } catch (e) {
      debugPrint('Error traversing upline refs: $e');
      return null;
    }
  }

  Future<void> _confirmAndLaunchOpportunity() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Before You Continue'),
        content: Text(
            "Important: After completing your ${bizOpp ?? 'business opportunity'} registration, you must return here to add your new referral link to your Team Build Pro profile. This ensures your downline is built correctly."),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('I Understand'),
          ),
        ],
      ),
    );

    if (!mounted || confirmed != true || bizOppRefUrl == null) return;

    // --- MODIFICATION: The client now only calls the Cloud Function ---
    // The backend now handles the date update and notification logic.
    try {
      HttpsCallable callable = FirebaseFunctions.instance
          .httpsCallable('notifySponsorOfBizOppVisit');
      await callable.call();

      if (mounted) {
        // Update the local state to reflect the change immediately
        setState(() => hasVisitedOpp = true);
        if (kDebugMode) {
          debugPrint("Successfully triggered sponsor notification function.");
        }
      }
    } on FirebaseFunctionsException catch (e) {
      if (kDebugMode) {
        debugPrint(
            "Error calling notifySponsorOfBizOppVisit: ${e.code} - ${e.message}");
      }
    }
    // --- End of modification ---

    // Launch the URL
    final url = Uri.parse(bizOppRefUrl!);
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open link: $bizOppRefUrl')),
        );
      }
    }
  }

  void _handleCompletedRegistrationClick() {
    if (hasVisitedOpp) {
      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => JoinOpportunityScreen(appId: widget.appId),
        ),
      );
    } else {
      if (mounted) {
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Visit Required First'),
            content: Text(
                "Before updating your profile, you must first use the 'Join Now' button on this page to visit '${bizOpp ?? 'the opportunity'}' and complete your registration."),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<UserModel?>(context);

    if (user == null) {
      return Scaffold(
        appBar: AppHeaderWithMenu(appId: widget.appId),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 16),
                  Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.celebration,
                            color: Colors.amber.shade700, size: 22),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            'Congratulations, ${user.firstName}!',
                            style: const TextStyle(
                                fontSize: 22, fontWeight: FontWeight.bold),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(Icons.celebration,
                            color: Colors.amber.shade700, size: 22),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: const TextStyle(
                          color: Colors.black87, fontSize: 18, height: 1.4),
                      children: [
                        const TextSpan(
                            text: "You're now eligible to register for "),
                        TextSpan(
                          text: bizOpp ?? 'your business opportunity',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const TextSpan(text: "!\n\nYour sponsor will be "),
                        TextSpan(
                          text: sponsorName ?? 'an upline Team Leader',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const TextSpan(text: "."),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.open_in_new),
                    label: Text('Join ${bizOpp ?? 'Opportunity'} Now!'),
                    onPressed: bizOppRefUrl != null
                        ? _confirmAndLaunchOpportunity
                        : null,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      textStyle: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w600),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 40),
                  const Center(
                    child: Text(
                      'Very Important Follow-up Step!',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.red,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    "After joining, you must return here and add your new referral link to your Team Build Pro profile. This ensures your downline is built correctly.",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 16, color: Colors.grey.shade700, height: 1.5),
                  ),
                  const SizedBox(height: 18),
                  OutlinedButton(
                    onPressed: _handleCompletedRegistrationClick,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.all(12),
                      side: BorderSide(color: Colors.indigo.shade200),
                    ),
                    child: const Text(
                      "I've registered.\nAdd my link now.",
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 18),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
