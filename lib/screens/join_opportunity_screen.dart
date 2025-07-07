// lib/screens/join_opportunity_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_model.dart';
import '../services/firestore_service.dart';
import '../widgets/header_widgets.dart';
import 'my_biz_screen.dart';
import 'package:flutter/foundation.dart';

class JoinOpportunityScreen extends StatefulWidget {
  final String appId;

  const JoinOpportunityScreen({super.key, required this.appId});

  @override
  State<JoinOpportunityScreen> createState() => _JoinOpportunityScreenState();
}

class _JoinOpportunityScreenState extends State<JoinOpportunityScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _refLinkController = TextEditingController();
  final TextEditingController _refLinkConfirmController =
      TextEditingController();
  final FirestoreService _firestoreService = FirestoreService();

  String? _baseUrl;
  String? _bizOpp;
  bool _isLoading = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _refLinkController.dispose();
    _refLinkConfirmController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final user = Provider.of<UserModel?>(context, listen: false);
      if (user == null) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      String? adminUid;
      if (user.role == 'admin') {
        adminUid = user.uid;
      } else {
        adminUid = user.uplineAdmin;
      }

      if (adminUid != null && adminUid.isNotEmpty) {
        final doc = await FirebaseFirestore.instance
            .collection('admin_settings')
            .doc(adminUid)
            .get();

        if (mounted && doc.exists) {
          final data = doc.data();
          final String? originalUrl = data?['biz_opp_ref_url'];

          setState(() {
            _bizOpp = data?['biz_opp'];
            if (originalUrl != null && originalUrl.isNotEmpty) {
              final uri = Uri.parse(originalUrl);
              _baseUrl = "${uri.scheme}://${uri.host}/";
            }
          });
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint("Error fetching admin settings: $e");
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _saveAndContinue() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _isSaving = true);

    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null) {
      if (mounted) setState(() => _isSaving = false);
      return;
    }

    try {
      // The user now enters the full URL, so we just trim it.
      await _firestoreService.updateUser(user.uid, {
        'biz_opp_ref_url': _refLinkController.text.trim(),
        'biz_join_date': FieldValue.serverTimestamp(),
        'biz_opp': _bizOpp,
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Profile Updated!'), backgroundColor: Colors.green),
      );
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => MyBizScreen(appId: widget.appId)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Widget _buildBulletPoint(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("• ", style: TextStyle(fontSize: 16, height: 1.5)),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(
                    fontSize: 16, color: Colors.black87, height: 1.5),
                children: [
                  ..._parseTextForBolding(text, _bizOpp ?? 'this opportunity'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<TextSpan> _parseTextForBolding(String text, String boldTerm) {
    if (!text.contains(boldTerm)) {
      return [TextSpan(text: text)];
    }
    final parts = text.split(boldTerm);
    List<TextSpan> spans = [];
    for (int i = 0; i < parts.length; i++) {
      spans.add(TextSpan(text: parts[i]));
      if (i < parts.length - 1) {
        spans.add(TextSpan(
            text: boldTerm,
            style: const TextStyle(fontWeight: FontWeight.bold)));
      }
    }
    return spans;
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
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Congratulations on Joining',
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '$_bizOpp',
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Important: Please Read Carefully!',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.red,
                      ),
                    ),
                    const SizedBox(height: 16),
                    RichText(
                      text: TextSpan(
                        style: const TextStyle(
                            fontSize: 16, color: Colors.black87, height: 1.5),
                        children: [
                          const TextSpan(
                              text:
                                  'You are about to link your TeamBuild Pro account to the '),
                          TextSpan(
                              text: _bizOpp ?? 'business',
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold)),
                          const TextSpan(text: ' opportunity.'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildBulletPoint(
                        'Your unique referral link can only be set one time.'),
                    _buildBulletPoint(
                        'Once set, your current and future TeamBuild Pro downline members will automatically be placed in your $_bizOpp downline.'),
                    _buildBulletPoint(
                        'This ensures your new downline is built correctly under you in ${_bizOpp ?? 'this opportunity'}.'),
                    const SizedBox(height: 8),
                    const Text(
                      'Please double-check that your link is accurate before saving.',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          height: 1.5),
                    ),
                    if (_baseUrl != null) ...[
                      const SizedBox(height: 32),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Enter Your Unique Referral Link",
                            style:
                                TextStyle(color: Colors.black54, fontSize: 16),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 12.0),
                            decoration: BoxDecoration(
                              border: Border.all(
                                  color: Colors.grey.shade400, width: 1.0),
                              borderRadius: BorderRadius.circular(8.0),
                              color: Colors.white,
                            ),
                            child: TextFormField(
                              controller: _refLinkController,
                              maxLines: null,
                              keyboardType: TextInputType.multiline,
                              decoration: InputDecoration(
                                border: InputBorder.none,
                                // --- MODIFICATION: hintText is now dynamic ---
                                hintText: 'e.g., ${_baseUrl}your_username_here',
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Please enter your unique referral link.';
                                }
                                if (!_baseUrl!.startsWith('https') ||
                                    !value.startsWith(_baseUrl!)) {
                                  return 'Link must begin with $_baseUrl';
                                }
                                return null;
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Confirm Your Unique Referral Link",
                            style:
                                TextStyle(color: Colors.black54, fontSize: 16),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 12.0),
                            decoration: BoxDecoration(
                              border: Border.all(
                                  color: Colors.grey.shade400, width: 1.0),
                              borderRadius: BorderRadius.circular(8.0),
                              color: Colors.white,
                            ),
                            child: TextFormField(
                              controller: _refLinkConfirmController,
                              maxLines: null,
                              keyboardType: TextInputType.multiline,
                              decoration: const InputDecoration(
                                border: InputBorder.none,
                                hintText: 'Re-enter your full referral link',
                              ),
                              validator: (value) {
                                if (value != _refLinkController.text) {
                                  return 'Referral links do not match';
                                }
                                return null;
                              },
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 32),
                    ElevatedButton.icon(
                      onPressed: _isSaving ? null : _saveAndContinue,
                      icon: _isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save),
                      label: Text(_isSaving ? 'Saving...' : 'Save & Continue'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        textStyle: const TextStyle(fontSize: 18),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
