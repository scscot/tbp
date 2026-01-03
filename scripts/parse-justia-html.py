#!/usr/bin/env python3
"""
Parse saved Justia HTML files to extract law firm information.

Usage:
    python scripts/parse-justia-html.py [folder_path]

    folder_path: Path to folder containing saved Justia HTML files (default: ~/Downloads)

The script will:
1. Find all HTML files in the specified folder that match Justia listing pages
2. Parse each file to extract lawyer/firm information
3. Deduplicate against existing law-firms-directory.csv
4. Append new firms to the CSV

Example:
    # Parse HTML files from Downloads folder
    python scripts/parse-justia-html.py

    # Parse HTML files from a specific folder
    python scripts/parse-justia-html.py ~/Desktop/justia-pages
"""

import os
import sys
import csv
import re
from datetime import datetime
from bs4 import BeautifulSoup
from urllib.parse import urlparse

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
CSV_PATH = os.path.join(PROJECT_DIR, "preintake", "law-firms-directory.csv")

def extract_domain(url):
    """Extract domain from URL, removing www. prefix."""
    if not url:
        return None
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except:
        return None

def clean_url(url):
    """Clean URL by removing tracking parameters."""
    if not url:
        return None
    # Remove UTM and other tracking parameters
    if "?" in url:
        base_url = url.split("?")[0]
        return base_url
    return url

def load_existing_domains():
    """Load existing domains from CSV to avoid duplicates."""
    domains = set()
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                website = row.get("website", "")
                if website:
                    domain = extract_domain(website)
                    if domain:
                        domains.add(domain)
    return domains

def parse_practice_area_from_filename(filename):
    """Try to extract practice area from filename."""
    filename_lower = filename.lower()
    practice_areas = {
        "personal-injury": "Personal Injury",
        "personal injury": "Personal Injury",
        "family": "Family Law",
        "criminal": "Criminal Defense",
        "immigration": "Immigration",
        "bankruptcy": "Bankruptcy",
        "workers-compensation": "Workers' Compensation",
        "workers compensation": "Workers' Compensation",
        "employment": "Employment Law",
        "social-security": "Social Security Disability",
        "social security": "Social Security Disability",
        "medical-malpractice": "Medical Malpractice",
        "medical malpractice": "Medical Malpractice",
        "estate": "Estate Planning",
    }
    for key, value in practice_areas.items():
        if key in filename_lower:
            return value
    return "Unknown"

def parse_location_from_text(text):
    """Extract city and state from location text like 'Inglewood, CA Personal Injury Attorney'."""
    if not text:
        return None, None
    # Pattern: "City, ST Practice Area Attorney"
    match = re.search(r"([A-Za-z\s]+),\s*([A-Z]{2})\s+", text)
    if match:
        city = match.group(1).strip()
        state = match.group(2).strip()
        return city, state
    return None, None

def parse_justia_html(html_content, filename):
    """Parse a Justia listing page HTML and extract lawyer information."""
    soup = BeautifulSoup(html_content, "html.parser")
    lawyers = []

    # Get practice area from filename or page content
    practice_area = parse_practice_area_from_filename(filename)

    # Find all lawyer cards
    cards = soup.find_all("div", class_="jld-card")

    for card in cards:
        try:
            # Skip sponsored listings section header cards
            if "-sponsor" in card.get("class", []):
                continue

            # Match the existing CSV schema: firm_name, website, practice_area, state
            lawyer_data = {
                "firm_name": None,
                "website": None,
                "practice_area": practice_area,
                "state": None,
            }

            # Extract name from strong.name > a[title]
            name_elem = card.find("strong", class_="name")
            if name_elem:
                name_link = name_elem.find("a", title=True)
                if name_link:
                    lawyer_data["firm_name"] = name_link.get("title", "").strip()

            # Extract location from div.rating
            rating_div = card.find("div", class_="rating")
            if rating_div:
                rating_text = rating_div.get_text()
                city, state = parse_location_from_text(rating_text)
                lawyer_data["state"] = state

            # Extract website from a[aria-label*="Website"]
            website_link = card.find("a", attrs={"aria-label": lambda x: x and "Website" in x})
            if website_link:
                raw_url = website_link.get("href", "")
                # Skip justia.lawyer redirect URLs - these aren't real firm websites
                if "justia.lawyer" not in raw_url:
                    lawyer_data["website"] = clean_url(raw_url)

            # Only add if we have a name
            if lawyer_data["firm_name"]:
                lawyers.append(lawyer_data)

        except Exception as e:
            print(f"  Error parsing card: {e}")
            continue

    return lawyers

def find_justia_html_files(folder_path):
    """Find all Justia HTML files in a folder."""
    html_files = []
    if not os.path.exists(folder_path):
        print(f"Folder not found: {folder_path}")
        return html_files

    for filename in os.listdir(folder_path):
        if filename.endswith(".html") and "Justia" in filename:
            html_files.append(os.path.join(folder_path, filename))

    return sorted(html_files)

def append_to_csv(new_firms):
    """Append new firms to the CSV file."""
    if not new_firms:
        return 0

    # Read existing CSV to get headers
    existing_rows = []
    headers = []
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            existing_rows = list(reader)

    # Ensure we have all required headers (matching existing CSV schema)
    if not headers:
        headers = ["firm_name", "website", "practice_area", "state",
                   "scraped_date", "extraction_attempted", "extraction_status"]

    # Add new tracking columns if they don't exist
    for col in ["scraped_date", "extraction_attempted", "extraction_status"]:
        if col not in headers:
            headers.append(col)

    # Prepare new rows
    today = datetime.now().strftime("%Y-%m-%d")
    new_rows = []
    for firm in new_firms:
        row = {h: "" for h in headers}
        row.update(firm)
        row["scraped_date"] = today
        row["extraction_status"] = "pending"
        new_rows.append(row)

    # Write all rows (existing + new)
    all_rows = existing_rows + new_rows
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(all_rows)

    return len(new_rows)

def main():
    # Get folder path from command line or use Downloads
    if len(sys.argv) > 1:
        folder_path = os.path.expanduser(sys.argv[1])
    else:
        folder_path = os.path.expanduser("~/Downloads")

    print(f"Searching for Justia HTML files in: {folder_path}")

    # Find HTML files
    html_files = find_justia_html_files(folder_path)
    if not html_files:
        print("No Justia HTML files found. Make sure filenames contain 'Justia'.")
        return

    print(f"Found {len(html_files)} Justia HTML file(s)")

    # Load existing domains for deduplication
    existing_domains = load_existing_domains()
    print(f"Loaded {len(existing_domains)} existing domains from CSV")

    # Parse all HTML files
    all_lawyers = []
    for html_file in html_files:
        filename = os.path.basename(html_file)
        print(f"\nParsing: {filename}")

        with open(html_file, "r", encoding="utf-8") as f:
            html_content = f.read()

        lawyers = parse_justia_html(html_content, filename)
        print(f"  Found {len(lawyers)} lawyers")
        all_lawyers.extend(lawyers)

    # Deduplicate
    print(f"\nTotal lawyers found: {len(all_lawyers)}")

    # Filter to only those with websites (we need websites for email extraction)
    with_websites = [l for l in all_lawyers if l.get("website")]
    print(f"Lawyers with websites: {len(with_websites)}")

    # Filter out duplicates
    new_firms = []
    seen_domains = set()
    for lawyer in with_websites:
        domain = extract_domain(lawyer["website"])
        if domain and domain not in existing_domains and domain not in seen_domains:
            new_firms.append(lawyer)
            seen_domains.add(domain)

    print(f"New firms (not in existing CSV): {len(new_firms)}")

    if new_firms:
        print("\nNew firms to add:")
        for firm in new_firms:
            print(f"  - {firm['firm_name']} ({firm['state']}) - {firm['website']}")

        # Append to CSV
        added = append_to_csv(new_firms)
        print(f"\nAdded {added} new firms to {CSV_PATH}")
    else:
        print("\nNo new firms to add.")

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"HTML files processed: {len(html_files)}")
    print(f"Total lawyers found: {len(all_lawyers)}")
    print(f"Lawyers with websites: {len(with_websites)}")
    print(f"New firms added: {len(new_firms)}")

if __name__ == "__main__":
    main()
