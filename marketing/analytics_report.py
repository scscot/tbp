#!/usr/bin/env python3
"""
Team Build Pro - Google Analytics 4 Data Reporter

Queries GA4 data via API to analyze download button performance and calculate conversion metrics.

Usage:
    python3 analytics_report.py --report ctr
    python3 analytics_report.py --report platform --days 7
    python3 analytics_report.py --report compare --start 2025-10-22 --end 2025-10-28
    python3 analytics_report.py --report export --output data.csv

Requirements:
    pip3 install google-analytics-data
"""

import os
import sys
import argparse
from datetime import datetime, timedelta
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest,
    DateRange,
    Dimension,
    Metric,
    FilterExpression,
    Filter,
)

# ==========================================
# CONFIGURATION
# ==========================================

# Set your GA4 Property ID (numeric, NOT the measurement ID G-G4E4TBBPZ7)
# Find this in Google Analytics → Admin → Property Settings → Property ID
PROPERTY_ID = "485651473"

# Path to service account key (created in setup guide)
CREDENTIALS_PATH = "/Users/sscott/tbp/secrets/ga4-service-account.json"

# Set environment variable for Google authentication
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = CREDENTIALS_PATH


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def initialize_client():
    """Initialize GA4 Data API client with credentials"""
    try:
        client = BetaAnalyticsDataClient()
        return client
    except Exception as e:
        print(f"❌ Error initializing GA4 client: {e}")
        print(f"\nTroubleshooting:")
        print(f"1. Check credentials file exists: {CREDENTIALS_PATH}")
        print(f"2. Verify service account has 'Viewer' role in GA4 property")
        print(f"3. Ensure Property ID is correct (numeric, not G-G4E4TBBPZ7)")
        sys.exit(1)


def format_date(date_str):
    """Convert date string to YYYY-MM-DD format"""
    if date_str in ['today', 'yesterday']:
        return date_str
    if date_str.endswith('daysAgo'):
        return date_str
    # Assume YYYY-MM-DD format
    return date_str


def calculate_ctr(clicks, views):
    """Calculate click-through rate as percentage"""
    if views == 0:
        return 0.0
    return (clicks / views) * 100


# ==========================================
# REPORT FUNCTIONS
# ==========================================

def get_ctr_report(client, start_date='7daysAgo', end_date='today'):
    """
    Calculate download button click-through rate (CTR)

    Returns:
        dict with page_views, button_clicks, ctr percentage
    """
    print(f"\n📊 Download Button CTR Report")
    print(f"Date Range: {start_date} to {end_date}")
    print("=" * 50)

    # Query 1: Get page views
    request_views = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        dimensions=[],  # No dimensions, just total
        metrics=[Metric(name="screenPageViews")],
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
    )

    response_views = client.run_report(request_views)
    page_views = int(response_views.rows[0].metric_values[0].value) if response_views.rows else 0

    # Query 2: Get download button clicks
    request_clicks = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        dimensions=[],
        metrics=[Metric(name="eventCount")],
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="eventName",
                string_filter=Filter.StringFilter(value="download_button_click")
            )
        ),
    )

    response_clicks = client.run_report(request_clicks)
    button_clicks = int(response_clicks.rows[0].metric_values[0].value) if response_clicks.rows else 0

    # Calculate CTR
    ctr = calculate_ctr(button_clicks, page_views)

    # Print results
    print(f"\n📈 Overall Metrics:")
    print(f"  Total Page Views: {page_views:,}")
    print(f"  Download Button Clicks: {button_clicks:,}")
    print(f"  Click-Through Rate: {ctr:.2f}%")

    return {
        'page_views': page_views,
        'button_clicks': button_clicks,
        'ctr': ctr
    }


def get_platform_breakdown(client, start_date='7daysAgo', end_date='today'):
    """
    Breakdown of clicks by platform (App Store vs. Google Play)

    Returns:
        dict with counts for each platform
    """
    print(f"\n📱 Platform Breakdown Report")
    print(f"Date Range: {start_date} to {end_date}")
    print("=" * 50)

    try:
        # Query: Get clicks by platform dimension
        request = RunReportRequest(
            property=f"properties/{PROPERTY_ID}",
            dimensions=[Dimension(name="customEvent:platform")],  # Custom parameter
            metrics=[Metric(name="eventCount")],
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            dimension_filter=FilterExpression(
                filter=Filter(
                    field_name="eventName",
                    string_filter=Filter.StringFilter(value="download_button_click")
                )
            ),
        )

        response = client.run_report(request)

        # Parse results
        platforms = {}
        total_clicks = 0

        for row in response.rows:
            platform = row.dimension_values[0].value
            count = int(row.metric_values[0].value)
            platforms[platform] = count
            total_clicks += count

        # Print results
        print(f"\n📊 Platform Distribution:")
        if total_clicks > 0:
            for platform, count in sorted(platforms.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_clicks) * 100
                print(f"  {platform.replace('_', ' ').title()}: {count:,} clicks ({percentage:.1f}%)")
        else:
            print(f"  No download button clicks found in this period")

        print(f"\n  Total Clicks: {total_clicks:,}")

        return platforms

    except Exception as e:
        if "not a valid dimension" in str(e):
            print(f"\n⚠️  Custom parameter 'platform' not yet registered in GA4")
            print(f"  This will populate once users click download buttons")
            print(f"  No platform data available yet")
            return {}
        else:
            raise


def get_device_breakdown(client, start_date='7daysAgo', end_date='today'):
    """
    Breakdown of clicks by device type (Mobile vs. Desktop)

    Returns:
        dict with counts for each device type
    """
    print(f"\n💻 Device Type Breakdown Report")
    print(f"Date Range: {start_date} to {end_date}")
    print("=" * 50)

    try:
        # Query: Get clicks by device_type dimension
        request = RunReportRequest(
            property=f"properties/{PROPERTY_ID}",
            dimensions=[Dimension(name="customEvent:device_type")],  # Custom parameter
            metrics=[Metric(name="eventCount")],
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            dimension_filter=FilterExpression(
                filter=Filter(
                    field_name="eventName",
                    string_filter=Filter.StringFilter(value="download_button_click")
                )
            ),
        )

        response = client.run_report(request)

        # Parse results
        devices = {}
        total_clicks = 0

        for row in response.rows:
            device = row.dimension_values[0].value
            count = int(row.metric_values[0].value)
            devices[device] = count
            total_clicks += count

        # Print results
        print(f"\n📊 Device Distribution:")
        if total_clicks > 0:
            for device, count in sorted(devices.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_clicks) * 100
                print(f"  {device.title()}: {count:,} clicks ({percentage:.1f}%)")
        else:
            print(f"  No download button clicks found in this period")

        print(f"\n  Total Clicks: {total_clicks:,}")

        return devices

    except Exception as e:
        if "not a valid dimension" in str(e):
            print(f"\n⚠️  Custom parameter 'device_type' not yet registered in GA4")
            print(f"  This will populate once users click download buttons")
            print(f"  No device data available yet")
            return {}
        else:
            raise


def get_country_breakdown(client, start_date='7daysAgo', end_date='today'):
    """
    Breakdown of page views by country

    Returns:
        dict with page views for each country
    """
    print(f"\n🌎 Country Breakdown Report")
    print(f"Date Range: {start_date} to {end_date}")
    print("=" * 50)

    # Query: Get page views by country
    request = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        dimensions=[Dimension(name="country")],
        metrics=[Metric(name="screenPageViews")],
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
    )

    response = client.run_report(request)

    # Parse results
    countries = {}
    total_views = 0

    for row in response.rows:
        country = row.dimension_values[0].value
        count = int(row.metric_values[0].value)
        countries[country] = count
        total_views += count

    # Print results
    print(f"\n📊 Country Distribution:")
    if total_views > 0:
        for country, count in sorted(countries.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total_views) * 100
            print(f"  {country}: {count:,} views ({percentage:.1f}%)")
    else:
        print(f"  No page views found in this period")

    print(f"\n  Total Page Views: {total_views:,}")

    return countries


def compare_periods(client, baseline_start, baseline_end, test_start, test_end):
    """
    Compare CTR between two time periods (before vs. after change)

    Args:
        baseline_start: Baseline period start date (e.g., '2025-10-22')
        baseline_end: Baseline period end date (e.g., '2025-10-28')
        test_start: Test period start date (e.g., '2025-10-29')
        test_end: Test period end date (e.g., '2025-11-04')
    """
    print(f"\n🔄 Before/After Comparison Report")
    print("=" * 50)

    # Get baseline period data
    print(f"\n📊 Baseline Period: {baseline_start} to {baseline_end}")
    baseline = get_ctr_report(client, baseline_start, baseline_end)

    # Get test period data
    print(f"\n📊 Test Period: {test_start} to {test_end}")
    test = get_ctr_report(client, test_start, test_end)

    # Calculate changes
    print(f"\n📈 Comparison Summary:")
    print("=" * 50)

    # Page views change
    views_change = ((test['page_views'] - baseline['page_views']) / baseline['page_views'] * 100) if baseline['page_views'] > 0 else 0
    views_symbol = "📈" if views_change > 0 else "📉" if views_change < 0 else "➡️"
    print(f"{views_symbol} Page Views: {baseline['page_views']:,} → {test['page_views']:,} ({views_change:+.1f}%)")

    # Clicks change
    clicks_change = ((test['button_clicks'] - baseline['button_clicks']) / baseline['button_clicks'] * 100) if baseline['button_clicks'] > 0 else 0
    clicks_symbol = "📈" if clicks_change > 0 else "📉" if clicks_change < 0 else "➡️"
    print(f"{clicks_symbol} Button Clicks: {baseline['button_clicks']:,} → {test['button_clicks']:,} ({clicks_change:+.1f}%)")

    # CTR change
    ctr_diff = test['ctr'] - baseline['ctr']
    ctr_symbol = "✅" if ctr_diff > 0 else "❌" if ctr_diff < 0 else "➡️"
    print(f"{ctr_symbol} Click-Through Rate: {baseline['ctr']:.2f}% → {test['ctr']:.2f}% ({ctr_diff:+.2f} pp)")

    # Decision recommendation
    print(f"\n💡 Recommendation:")
    if ctr_diff >= 0.05:  # +5% or more improvement
        print(f"   ✅ KEEP CHANGE - CTR improved significantly (+{ctr_diff:.2f} percentage points)")
    elif ctr_diff >= 0:
        print(f"   ✅ KEEP CHANGE - CTR improved or stayed neutral (no harm)")
    elif ctr_diff > -0.10:  # Less than 10% decline
        print(f"   ⚠️  MONITOR - Small CTR decline ({ctr_diff:.2f} pp), watch for another week")
    else:
        print(f"   ❌ REVERT CHANGE - CTR declined significantly ({ctr_diff:.2f} pp)")

    return {
        'baseline': baseline,
        'test': test,
        'views_change': views_change,
        'clicks_change': clicks_change,
        'ctr_diff': ctr_diff
    }


def export_to_csv(client, start_date='30daysAgo', end_date='today', output_file='ga4_data.csv'):
    """
    Export GA4 data to CSV file for further analysis

    Args:
        output_file: Path to save CSV file
    """
    print(f"\n💾 Exporting Data to CSV")
    print(f"Date Range: {start_date} to {end_date}")
    print(f"Output File: {output_file}")
    print("=" * 50)

    # Query: Get daily metrics
    request = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        dimensions=[
            Dimension(name="date"),
            Dimension(name="customEvent:platform"),
            Dimension(name="customEvent:device_type"),
        ],
        metrics=[Metric(name="eventCount")],
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="eventName",
                string_filter=Filter.StringFilter(value="download_button_click")
            )
        ),
    )

    response = client.run_report(request)

    # Write to CSV
    import csv
    with open(output_file, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        # Header
        writer.writerow(['Date', 'Platform', 'Device Type', 'Click Count'])

        # Data rows
        for row in response.rows:
            date = row.dimension_values[0].value
            platform = row.dimension_values[1].value
            device = row.dimension_values[2].value
            count = row.metric_values[0].value

            writer.writerow([date, platform, device, count])

    print(f"✅ Exported {len(response.rows)} rows to {output_file}")
    return output_file


# ==========================================
# COMMAND-LINE INTERFACE
# ==========================================

def main():
    parser = argparse.ArgumentParser(
        description='Team Build Pro - Google Analytics 4 Data Reporter',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Get CTR for last 7 days
  python3 analytics_report.py --report ctr

  # Platform breakdown for last 30 days
  python3 analytics_report.py --report platform --days 30

  # Country breakdown for last 7 days
  python3 analytics_report.py --report country

  # Compare before/after periods
  python3 analytics_report.py --report compare --start 2025-10-22 --end 2025-10-28

  # Export data to CSV
  python3 analytics_report.py --report export --output data.csv
        """
    )

    parser.add_argument('--report',
                        choices=['ctr', 'platform', 'device', 'country', 'compare', 'export', 'all'],
                        required=True,
                        help='Type of report to generate')

    parser.add_argument('--days',
                        type=int,
                        default=7,
                        help='Number of days to analyze (default: 7)')

    parser.add_argument('--start',
                        type=str,
                        help='Start date for comparison baseline (YYYY-MM-DD)')

    parser.add_argument('--end',
                        type=str,
                        help='End date for comparison baseline (YYYY-MM-DD)')

    parser.add_argument('--output',
                        type=str,
                        default='ga4_data.csv',
                        help='Output CSV filename (default: ga4_data.csv)')

    args = parser.parse_args()

    # Validate Property ID is set
    if PROPERTY_ID == "YOUR_PROPERTY_ID_HERE":
        print("❌ Error: PROPERTY_ID not configured")
        print("\nPlease edit analytics_report.py and set PROPERTY_ID to your numeric GA4 Property ID")
        print("Find it in: Google Analytics → Admin → Property Settings → Property ID")
        sys.exit(1)

    # Initialize client
    print(f"\n🔐 Authenticating with Google Analytics...")
    client = initialize_client()
    print(f"✅ Connected to GA4 Property: {PROPERTY_ID}")

    # Calculate date range
    end_date = 'today'
    start_date = f'{args.days}daysAgo'

    # Run requested report
    if args.report == 'ctr':
        get_ctr_report(client, start_date, end_date)

    elif args.report == 'platform':
        get_platform_breakdown(client, start_date, end_date)

    elif args.report == 'device':
        get_device_breakdown(client, start_date, end_date)

    elif args.report == 'country':
        get_country_breakdown(client, start_date, end_date)

    elif args.report == 'compare':
        # Require start and end dates for baseline
        if not args.start or not args.end:
            print("❌ Error: --start and --end dates required for comparison report")
            print("\nExample: python3 analytics_report.py --report compare --start 2025-10-22 --end 2025-10-28")
            sys.exit(1)

        # Calculate test period (same duration as baseline, starting day after baseline ends)
        baseline_start = args.start
        baseline_end = args.end

        # Parse dates to calculate test period
        from datetime import datetime, timedelta
        baseline_end_dt = datetime.strptime(baseline_end, '%Y-%m-%d')
        test_start_dt = baseline_end_dt + timedelta(days=1)
        test_start = test_start_dt.strftime('%Y-%m-%d')

        baseline_days = (baseline_end_dt - datetime.strptime(baseline_start, '%Y-%m-%d')).days + 1
        test_end_dt = test_start_dt + timedelta(days=baseline_days - 1)
        test_end = test_end_dt.strftime('%Y-%m-%d')

        compare_periods(client, baseline_start, baseline_end, test_start, test_end)

    elif args.report == 'export':
        export_to_csv(client, start_date, end_date, args.output)

    elif args.report == 'all':
        # Run all reports
        get_ctr_report(client, start_date, end_date)
        get_platform_breakdown(client, start_date, end_date)
        get_device_breakdown(client, start_date, end_date)
        get_country_breakdown(client, start_date, end_date)

    print(f"\n✅ Report Complete!\n")


if __name__ == '__main__':
    main()
