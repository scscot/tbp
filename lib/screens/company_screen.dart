// lib/screens/company_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../widgets/header_widgets.dart';

class CompanyScreen extends StatefulWidget {
  final String appId;

  const CompanyScreen({
    super.key,
    required this.appId,
  });

  @override
  State<CompanyScreen> createState() => _CompanyScreenState();
}

class _CompanyScreenState extends State<CompanyScreen> {
  String? bizOpp;
  String? bizOppRefUrl;
  Timestamp? bizJoinDate;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  // The data loading logic was already correct and remains unchanged.
  Future<void> _loadUserData() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      if (mounted) setState(() => loading = false);
      return;
    }

    try {
      final doc =
          await FirebaseFirestore.instance.collection('users').doc(uid).get();
      if (!mounted) return;

      final data = doc.data();
      if (data == null) {
        if (mounted) Navigator.of(context).pop();
        return;
      }

      // Allow both admin and user roles to access company screen
      final role = data['role'] as String?;
      if (role != 'user' && role != 'admin') {
        if (mounted) Navigator.of(context).pop();
        return;
      }

      // For admin users, get data from admin_settings collection
      if (role == 'admin') {
        try {
          final adminDoc = await FirebaseFirestore.instance
              .collection('admin_settings')
              .doc(uid)
              .get();
          
          if (adminDoc.exists) {
            final adminData = adminDoc.data();
            setState(() {
              bizOpp = adminData?['biz_opp'] as String?;
              bizOppRefUrl = adminData?['biz_opp_ref_url'] as String?;
              bizJoinDate = null; // Admin doesn't have join date
              loading = false;
            });
          } else {
            if (mounted) Navigator.of(context).pop();
          }
        } catch (e) {
          debugPrint("Error loading admin data: $e");
          if (mounted) Navigator.of(context).pop();
        }
        return;
      }

      // For regular users, check if they have business opportunity data
      if (data['biz_opp_ref_url'] == null) {
        if (mounted) Navigator.of(context).pop();
        return;
      }

      setState(() {
        bizOpp = data['biz_opp'] as String?;
        bizOppRefUrl = data['biz_opp_ref_url'] as String?;
        // --- NOTE: Firestore field should be 'biz_visit_date' based on our previous work ---
        bizJoinDate = data['biz_visit_date'] as Timestamp?;
        loading = false;
      });
    } catch (e) {
      debugPrint("Error loading CompanyScreen data: $e");
      if (mounted) setState(() => loading = false);
    }
  }

  // --- ADDED: Functionality to copy the referral link ---

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // --- MODIFICATION: Refreshed UI for a more premium feel ---
                  const SizedBox(height: 20),
                  const Center(
                    child: Text(
                      'My Company Details',
                      style:
                          TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 30),
                  Card(
                    elevation: 4,
                    shadowColor: Colors.grey.withOpacity(0.2),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15)),
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        children: [
                          _buildInfoRow(
                            title: 'Company Name',
                            content: bizOpp ?? 'Not available',
                            icon: Icons.business,
                          ),
                          const Divider(height: 24),
                          _buildInfoRow(
                            title: 'My Unique Referral Link',
                            content: bizOppRefUrl ?? 'Not available',
                            icon: Icons.link,
                          ),
                          /* const Divider(height: 24),
                          _buildInfoRow(
                            title: 'Date Joined',
                            content: bizJoinDate != null
                                ? DateFormat.yMMMMd()
                                    .format(bizJoinDate!.toDate())
                                : 'Not available',
                            icon: Icons.calendar_today,
                          ), */
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.indigo.shade50,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      "From this point forward, anyone in your Network Build Pro organization that joins $bizOpp will automatically be placed in your $bizOpp organization.",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 15,
                          color: Colors.indigo.shade800,
                          height: 1.5),
                    ),
                  ),
                  
                ],
              ),
            ),
    );
  }

  // --- MODIFICATION: Updated info row to support a trailing widget ---
  Widget _buildInfoRow({
    required String title,
    required String content,
    required IconData icon,
    Widget? trailing,
  }) {
    return Row(
      children: [
        Icon(icon, size: 28, color: Colors.indigo),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
              const SizedBox(height: 4),
              Text(content,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 16)),
            ],
          ),
        ),
        if (trailing != null) trailing,
      ],
    );
  }
}
