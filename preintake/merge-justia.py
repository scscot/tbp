#!/usr/bin/env python3
"""Merge Justia scraper results with existing law-firms-directory.csv"""
import csv
import re
from urllib.parse import urlparse

# Read existing CSV to get known domains
existing_domains = set()
existing_rows = []

with open('law-firms-directory.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        existing_rows.append(row)
        domain = urlparse(row['website']).netloc.lower()
        if domain.startswith('www.'):
            domain = domain[4:]
        existing_domains.add(domain)

print(f"Existing firms: {len(existing_rows)}")
print(f"Existing domains: {len(existing_domains)}")

# Parse scraper output
new_entries = []
with open('/tmp/claude/tasks/b592385.output', 'r') as f:
    for line in f:
        # Match lines like: [  1] Bankruptcy | Firm Name | https://example.com
        match = re.match(r'\[\s*\d+\]\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(\S+)', line)
        if match:
            practice_area = match.group(1).strip()
            firm_name = match.group(2).strip()
            website = match.group(3).strip()

            # Skip bad entries
            if 'Find a Lawyer' in firm_name:
                firm_name = ""  # Will use domain
            if 'policies.google.com' in website:
                continue
            if 'lawyers.com' == urlparse(website).netloc:
                continue
            if 'justia.' in website.lower():
                continue

            # Extract domain
            domain = urlparse(website).netloc.lower()
            if domain.startswith('www.'):
                domain = domain[4:]

            if not domain:
                continue

            # Check if new
            if domain not in existing_domains:
                # Clean firm name
                if not firm_name:
                    firm_name = domain.split('.')[0].title()
                # Remove excessive text
                if len(firm_name) > 60:
                    firm_name = firm_name[:60].rsplit(' ', 1)[0]

                # Clean URL - remove UTM params
                clean_url = website.split('?')[0]

                new_entries.append({
                    'firm_name': firm_name,
                    'website': clean_url,
                    'practice_area': practice_area,
                    'state': 'VA'  # Most are from Virginia based on output
                })
                existing_domains.add(domain)

print(f"New unique entries: {len(new_entries)}")

# Append to CSV
with open('law-firms-directory.csv', 'a', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['firm_name', 'website', 'practice_area', 'state'])
    for entry in new_entries:
        writer.writerow(entry)

print(f"Total firms now: {len(existing_rows) + len(new_entries)}")
