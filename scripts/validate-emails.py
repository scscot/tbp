#!/usr/bin/env python3
"""
Validate emails using Rapid Email Verifier API (free, no auth required).
Processes emails in batches of 100.

Usage:
    python3 validate-emails.py
"""

import csv
import json
import time
import requests
from pathlib import Path

API_URL = "https://rapid-email-verifier.fly.dev/api/validate/batch"
BATCH_SIZE = 100
DELAY_BETWEEN_BATCHES = 0.5  # seconds

def validate_batch(emails):
    """Validate a batch of emails (max 100)."""
    try:
        response = requests.post(
            API_URL,
            json={"emails": emails},
            headers={"Content-Type": "application/json"},
            timeout=120
        )
        if response.status_code == 200:
            return response.json()
        else:
            print(f"  API error: {response.status_code}")
            return None
    except Exception as e:
        print(f"  Request error: {e}")
        return None

def process_file(input_file, valid_output, invalid_output):
    """Process a CSV file and separate valid/invalid emails."""
    print(f"\n{'='*60}")
    print(f"Processing: {input_file}")
    print(f"{'='*60}")

    # Read all rows
    rows = []
    with open(input_file, 'r') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    print(f"Total emails: {len(rows)}")

    # Extract emails for validation
    email_to_row = {row['email'].lower(): row for row in rows}
    emails = list(email_to_row.keys())

    valid_rows = []
    invalid_rows = []
    invalid_reasons = {}

    # Process in batches
    total_batches = (len(emails) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(emails), BATCH_SIZE):
        batch = emails[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1

        print(f"  Batch {batch_num}/{total_batches} ({len(batch)} emails)...", end=" ", flush=True)

        results = validate_batch(batch)

        if results is None:
            # API failed - assume all valid to avoid data loss
            print("FAILED - keeping all emails")
            for email in batch:
                valid_rows.append(email_to_row[email])
        else:
            valid_count = 0
            invalid_count = 0

            for result in results.get('results', []):
                email = result.get('email', '').lower()
                status = result.get('status', 'UNKNOWN')

                # VALID status means email is good
                is_valid = status == 'VALID'

                if email in email_to_row:
                    if is_valid:
                        valid_rows.append(email_to_row[email])
                        valid_count += 1
                    else:
                        invalid_rows.append(email_to_row[email])
                        invalid_count += 1
                        # Track reason
                        invalid_reasons[status] = invalid_reasons.get(status, 0) + 1

            print(f"valid: {valid_count}, invalid: {invalid_count}")

        # Small delay between batches
        if i + BATCH_SIZE < len(emails):
            time.sleep(DELAY_BETWEEN_BATCHES)

    # Write valid emails
    with open(valid_output, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(valid_rows)

    # Write invalid emails
    with open(invalid_output, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(invalid_rows)

    print(f"\nResults:")
    print(f"  Valid: {len(valid_rows)} -> {valid_output}")
    print(f"  Invalid: {len(invalid_rows)} -> {invalid_output}")

    if invalid_reasons:
        print(f"\nInvalid reasons:")
        for reason, count in sorted(invalid_reasons.items(), key=lambda x: -x[1]):
            print(f"  {reason}: {count}")

    return len(valid_rows), len(invalid_rows)

def main():
    base_dir = Path('/Users/sscott/tbp/emails')

    print("Email Validation using Rapid Email Verifier API")
    print("=" * 60)

    total_valid = 0
    total_invalid = 0

    # Process Google emails
    v, i = process_file(
        base_dir / 'tbpleads.csv',
        base_dir / 'tbpleads_validated.csv',
        base_dir / 'tbpleads_invalid.csv'
    )
    total_valid += v
    total_invalid += i

    # Process non-Google emails
    v, i = process_file(
        base_dir / 'tbpleads_non_google.csv',
        base_dir / 'tbpleads_non_google_validated.csv',
        base_dir / 'tbpleads_non_google_invalid.csv'
    )
    total_valid += v
    total_invalid += i

    print(f"\n{'='*60}")
    print(f"TOTAL SUMMARY")
    print(f"{'='*60}")
    print(f"Total Valid: {total_valid}")
    print(f"Total Invalid: {total_invalid}")
    print(f"\nValidated files ready:")
    print(f"  - tbpleads_validated.csv")
    print(f"  - tbpleads_non_google_validated.csv")

if __name__ == '__main__':
    main()
