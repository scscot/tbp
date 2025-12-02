#!/usr/bin/env python3
"""
Extract unique firstName, lastName, email from MySQL dump files.
Handles large files efficiently by streaming.
"""

import re
import csv
import sys
from pathlib import Path

def extract_values_from_sql(sql_file):
    """Extract (first_name, last_name, email) tuples from SQL INSERT statements."""
    leads = []

    # Pattern to match individual value tuples in INSERT statements
    # Handles: (id,NULL,'value','value',...) format
    value_pattern = re.compile(r"\(([^)]+)\)")

    with open(sql_file, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if not line.startswith('INSERT INTO'):
                continue

            # Find all value tuples in this INSERT statement
            for match in value_pattern.finditer(line):
                values_str = match.group(1)

                # Parse the comma-separated values, handling quoted strings
                values = []
                current = ''
                in_quotes = False
                escape_next = False

                for char in values_str:
                    if escape_next:
                        current += char
                        escape_next = False
                        continue

                    if char == '\\':
                        escape_next = True
                        continue

                    if char == "'" and not in_quotes:
                        in_quotes = True
                        continue
                    elif char == "'" and in_quotes:
                        in_quotes = False
                        continue

                    if char == ',' and not in_quotes:
                        values.append(current.strip())
                        current = ''
                        continue

                    current += char

                # Don't forget the last value
                values.append(current.strip())

                # Extract first_name (5), last_name (6), email (7) - 0-indexed
                if len(values) > 7:
                    first_name = values[5].strip()
                    last_name = values[6].strip()
                    email = values[7].strip().lower()

                    # Skip NULL or empty values and validate email format
                    if (first_name and first_name != 'NULL' and
                        email and email != 'NULL' and
                        '@' in email and
                        '.' in email.split('@')[-1] and  # Domain must have a dot
                        not ' ' in email and  # No spaces in email
                        len(email) < 100):  # Reasonable length
                        leads.append((first_name, last_name, email))

    return leads

def main():
    sql_files = [
        Path.home() / 'Downloads' / 'kwphrase1.sql',
        Path.home() / 'Downloads' / 'kwphrase2.sql'
    ]

    output_file = Path('/Users/sscott/tbp/emails/tbpleads.csv')

    all_leads = []
    seen_emails = set()

    for sql_file in sql_files:
        print(f"Processing {sql_file.name}...")
        leads = extract_values_from_sql(sql_file)
        print(f"  Found {len(leads)} records")

        for first_name, last_name, email in leads:
            email_lower = email.lower()
            if email_lower not in seen_emails:
                seen_emails.add(email_lower)
                all_leads.append((first_name, last_name, email))

    print(f"\nTotal unique leads: {len(all_leads)}")

    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['firstName', 'lastName', 'email'])
        for first_name, last_name, email in all_leads:
            writer.writerow([first_name, last_name, email])

    print(f"Written to: {output_file}")

if __name__ == '__main__':
    main()
