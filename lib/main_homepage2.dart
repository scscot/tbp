// lib/main_homepage2.dart - Temporary main file for Homepage Example 2
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'config/app_constants.dart';
import 'firebase_options.dart';
import 'screens/homepage_screen_example2.dart';
import 'package:intl/date_symbol_data_local.dart';

const String appId = 'L8n1tJqHqYd3F5j6';

void main() async {
  try {
    WidgetsFlutterBinding.ensureInitialized();
    
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    
    await AppConstants.initialize();
    await initializeDateFormatting('en_US', null);
    
    runApp(const HomepageExample2App());
  } catch (e) {
    debugPrint('Error initializing app: $e');
    runApp(const HomepageExample2App());
  }
}

class HomepageExample2App extends StatelessWidget {
  const HomepageExample2App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Team Build Pro - Homepage Example 2',
      theme: ThemeData(
        primarySwatch: Colors.indigo,
        fontFamily: 'Inter',
      ),
      debugShowCheckedModeBanner: false,
      home: HomepageScreenExample2(
        referralCode: 'DEMO456', // Demo referral code
        appId: appId,
      ),
    );
  }
}
