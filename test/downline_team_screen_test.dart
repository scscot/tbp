import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ultimatefix/screens/downline_team_screen.dart';

void main() {
  group('DownlineTeamScreen Tests', () {
    testWidgets('DownlineTeamScreen builds without errors', (WidgetTester tester) async {
      // Build the DownlineTeamScreen widget
      await tester.pumpWidget(
        MaterialApp(
          home: DownlineTeamScreen(appId: 'test_app_id'),
        ),
      );

      // Verify the screen builds without throwing errors
      expect(find.byType(DownlineTeamScreen), findsOneWidget);
    });

    testWidgets('Analytics cards are displayed', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: DownlineTeamScreen(appId: 'test_app_id'),
        ),
      );

      // Wait for the widget to build
      await tester.pump();

      // Check for analytics cards text
      expect(find.text('Total Team Members'), findsOneWidget);
      expect(find.text('Direct Sponsors'), findsOneWidget);
      expect(find.text('New Members'), findsOneWidget);
    });

    testWidgets('Filter dropdown is present', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: DownlineTeamScreen(appId: 'test_app_id'),
        ),
      );

      await tester.pump();

      // Check for filter dropdown
      expect(find.text('Filter'), findsOneWidget);
    });

    testWidgets('Search field is present', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: DownlineTeamScreen(appId: 'test_app_id'),
        ),
      );

      await tester.pump();

      // Check for search field
      expect(find.text('Search members...'), findsOneWidget);
    });

    testWidgets('View mode toggle is present', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: DownlineTeamScreen(appId: 'test_app_id'),
        ),
      );

      await tester.pump();

      // Check for view mode icons
      expect(find.byIcon(Icons.grid_view), findsOneWidget);
      expect(find.byIcon(Icons.list), findsOneWidget);
      expect(find.byIcon(Icons.analytics), findsOneWidget);
    });

    testWidgets('Header displays correct title', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: DownlineTeamScreen(appId: 'test_app_id'),
        ),
      );

      await tester.pump();

      // Check for header title
      expect(find.text('Team Analytics'), findsOneWidget);
      expect(find.text('Manage and track your downline performance'), findsOneWidget);
    });
  });
}
