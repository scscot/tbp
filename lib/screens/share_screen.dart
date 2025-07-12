import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../widgets/header_widgets.dart';
import '../models/user_model.dart';

class ShareScreen extends StatefulWidget {
  final String appId;

  const ShareScreen({
    super.key,
    required this.appId,
  });

  @override
  State<ShareScreen> createState() => _ShareScreenState();
}

class _ShareScreenState extends State<ShareScreen> {
  UserModel? _currentUser;
  bool _isLoading = true;
  String? _mainAppLink;
  String? _personalReferralLink;

  @override
  void initState() {
    super.initState();
    _loadCurrentUser();
  }

  Future<void> _loadCurrentUser() async {
    try {
      final authUser = FirebaseAuth.instance.currentUser;
      if (authUser != null) {
        final doc = await FirebaseFirestore.instance
            .collection('users')
            .doc(authUser.uid)
            .get();

        if (doc.exists) {
          _currentUser = UserModel.fromMap(doc.data()!);
          _buildReferralLinks();
        }
      }
    } catch (e) {
      debugPrint('Error loading current user: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _buildReferralLinks() {
    if (_currentUser != null) {
      // Main app link for existing business opportunity downline members
      _mainAppLink =
          'https://teambuildpro.com/?new=${_currentUser!.referralCode}';

      // Personal referral link with referralCode for new prospects
      _personalReferralLink =
          'https://teambuildpro.com/?ref=${_currentUser!.referralCode}';
    }
  }

  void _shareMainAppLink() {
    if (_mainAppLink != null) {
      final bizOppName = _currentUser?.bizOpp ?? 'our business opportunity';
      final message =
          'Start your own $bizOppName organization with Team Build Pro App and build your business network: $_mainAppLink';
      Share.share(message);
    }
  }

  void _sharePersonalReferralLink() {
    if (_personalReferralLink != null) {
      final bizOppName = _currentUser?.bizOpp ?? 'our business opportunity';
      final message = _currentUser?.role == 'admin'
          ? 'Join my $bizOppName team on the Team Build Pro App and start building your business network: $_personalReferralLink'
          : 'Join me on the Team Build Pro App and start building your business network: $_personalReferralLink';

      Share.share(message);
    }
  }

  void _copyMainAppLink() {
    if (_mainAppLink != null) {
      Clipboard.setData(ClipboardData(text: _mainAppLink!));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Main app link copied to clipboard!'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _copyPersonalReferralLink() {
    if (_personalReferralLink != null) {
      Clipboard.setData(ClipboardData(text: _personalReferralLink!));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Personal referral link copied to clipboard!'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(
        appId: widget.appId,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const SizedBox(height: 24),
                    if (_currentUser?.role == 'admin') ...[
                      // Personal Referral Link Section - Rapid Growth Strategy
                      Card(
                        elevation: 6,
                        shadowColor: Colors.green.withValues(alpha: 0.2),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            gradient: LinearGradient(
                              colors: [
                                Colors.green.withOpacity(0.05),
                                Colors.white,
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: Colors.green.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(Icons.flash_on,
                                        color: Colors.green, size: 24),
                                  ),
                                  const SizedBox(width: 12),
                                  const Text(
                                    'Rapid Growth Strategy',
                                    style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              RichText(
                                textAlign: TextAlign.center,
                                text: TextSpan(
                                  style: const TextStyle(
                                      fontSize: 14, color: Colors.black),
                                  children: [
                                    const TextSpan(
                                        text:
                                            'Share this with people who have committed to joining '),
                                    TextSpan(
                                      text: _currentUser?.bizOpp ??
                                          'your business opportunity',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.blue),
                                    ),
                                    const TextSpan(
                                        text:
                                            ' but haven\'t joined yet. They can download and use the Team Build Pro App to pre-build their team before officially joining, positioning them for rapid growth once they\'re in your '),
                                    TextSpan(
                                      text: _currentUser?.bizOpp ??
                                          'business opportunity',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.blue),
                                    ),
                                    const TextSpan(text: ' downline.'),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 20),
                              if (_personalReferralLink != null) ...[
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.grey[50],
                                    borderRadius: BorderRadius.circular(12),
                                    border:
                                        Border.all(color: Colors.grey[200]!),
                                  ),
                                  child: Column(
                                    children: [
                                      Text(
                                        _personalReferralLink!,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: Colors.blue,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                      const SizedBox(height: 16),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceEvenly,
                                        children: [
                                          ElevatedButton.icon(
                                            icon: const Icon(Icons.copy),
                                            label: const Text('Copy'),
                                            onPressed:
                                                _copyPersonalReferralLink,
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.grey[600],
                                              foregroundColor: Colors.white,
                                              elevation: 2,
                                            ),
                                          ),
                                          ElevatedButton.icon(
                                            icon: const Icon(Icons.share),
                                            label: const Text('Share'),
                                            onPressed:
                                                _sharePersonalReferralLink,
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.green,
                                              foregroundColor: Colors.white,
                                              elevation: 2,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Main App Link Section - Hyper Growth Strategy
                      Card(
                        elevation: 6,
                        shadowColor: Colors.orange.withOpacity(0.2),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            gradient: LinearGradient(
                              colors: [
                                Colors.orange.withOpacity(0.05),
                                Colors.white,
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: Colors.orange.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(Icons.rocket_launch,
                                        color: Colors.orange, size: 24),
                                  ),
                                  const SizedBox(width: 12),
                                  const Text(
                                    'Hyper Growth Strategy',
                                    style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              RichText(
                                textAlign: TextAlign.center,
                                text: TextSpan(
                                  style: const TextStyle(
                                      fontSize: 14, color: Colors.black),
                                  children: [
                                    const TextSpan(
                                        text:
                                            'Share this with people already in your '),
                                    TextSpan(
                                      text: _currentUser?.bizOpp ??
                                          'business opportunity',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.blue),
                                    ),
                                    const TextSpan(
                                        text:
                                            ' downline. They can download and use the Team Build Pro App to continue building their team, and when their Team Build Pro App members join '),
                                    TextSpan(
                                      text: _currentUser?.bizOpp ??
                                          'your business opportunity',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.blue),
                                    ),
                                    const TextSpan(
                                        text:
                                            ', they\'ll automatically be placed in your '),
                                    TextSpan(
                                      text: _currentUser?.bizOpp ??
                                          'business opportunity',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.blue),
                                    ),
                                    const TextSpan(text: ' downline!'),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 20),
                              if (_mainAppLink != null) ...[
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.grey[50],
                                    borderRadius: BorderRadius.circular(12),
                                    border:
                                        Border.all(color: Colors.grey[200]!),
                                  ),
                                  child: Column(
                                    children: [
                                      Text(
                                        _mainAppLink!,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: Colors.blue,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                      const SizedBox(height: 16),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceEvenly,
                                        children: [
                                          ElevatedButton.icon(
                                            icon: const Icon(Icons.copy),
                                            label: const Text('Copy'),
                                            onPressed: _copyMainAppLink,
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.grey[600],
                                              foregroundColor: Colors.white,
                                              elevation: 2,
                                            ),
                                          ),
                                          ElevatedButton.icon(
                                            icon: const Icon(Icons.share),
                                            label: const Text('Share'),
                                            onPressed: _shareMainAppLink,
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.orange,
                                              foregroundColor: Colors.white,
                                              elevation: 2,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ] else ...[
                      // Personal Referral Link Section for Regular Users
                      Card(
                        elevation: 6,
                        shadowColor: Colors.green.withOpacity(0.2),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            gradient: LinearGradient(
                              colors: [
                                Colors.green.withOpacity(0.05),
                                Colors.white,
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: Colors.green.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(Icons.flash_on,
                                        color: Colors.green, size: 24),
                                  ),
                                  const SizedBox(width: 12),
                                  const Text(
                                    'Rapid Growth Strategy',
                                    style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              RichText(
                                textAlign: TextAlign.center,
                                text: TextSpan(
                                  style: const TextStyle(
                                      fontSize: 14, color: Colors.black),
                                  children: [
                                    const TextSpan(
                                        text:
                                            'Share this with people who have committed to joining '),
                                    TextSpan(
                                      text: _currentUser?.bizOpp ??
                                          'your business opportunity',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.blue),
                                    ),
                                    const TextSpan(
                                        text:
                                            ' but haven\'t joined yet. They can download and use the Team Build Pro App to pre-build their team before officially joining, positioning them for rapid growth once they\'re in your '),
                                    TextSpan(
                                      text: _currentUser?.bizOpp ??
                                          'business opportunity',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.blue),
                                    ),
                                    const TextSpan(text: ' downline.'),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 20),
                              if (_personalReferralLink != null) ...[
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.grey[50],
                                    borderRadius: BorderRadius.circular(12),
                                    border:
                                        Border.all(color: Colors.grey[200]!),
                                  ),
                                  child: Column(
                                    children: [
                                      Text(
                                        _personalReferralLink!,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: Colors.blue,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                      const SizedBox(height: 16),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceEvenly,
                                        children: [
                                          ElevatedButton.icon(
                                            icon: const Icon(Icons.copy),
                                            label: const Text('Copy'),
                                            onPressed:
                                                _copyPersonalReferralLink,
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.grey[600],
                                              foregroundColor: Colors.white,
                                              elevation: 2,
                                            ),
                                          ),
                                          ElevatedButton.icon(
                                            icon: const Icon(Icons.share),
                                            label: const Text('Share'),
                                            onPressed:
                                                _sharePersonalReferralLink,
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.green,
                                              foregroundColor: Colors.white,
                                              elevation: 2,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ] else
                                const Text(
                                  'Unable to generate referral link. Please try again.',
                                  style: TextStyle(color: Colors.red),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 32),

                    // Pro Tips section
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.grey[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey[300]!),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.lightbulb, color: Colors.amber[600]),
                              const SizedBox(width: 8),
                              Text(
                                'Pro Tips',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.bold,
                                    ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _buildTip(
                              'Share consistently across all your social media platforms'),
                          _buildTip('Personalize your message when sharing'),
                          _buildTip(
                              'Follow up with prospects who show interest'),
                          if (_currentUser?.role == 'admin')
                            _buildTip(
                                'Use both strategies for maximum growth potential'),
                        ],
                      ),
                    ),

                    const SizedBox(height: 32),
                    if (_currentUser?.role != 'admin') ...[
                      const Divider(),
                      const SizedBox(height: 16),
                      Text(
                        'Your Referral Code: ${_currentUser?.referralCode ?? 'Not Available'}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Others can use this code during registration to join your team.',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildTip(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 6),
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: Colors.grey[600],
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}
