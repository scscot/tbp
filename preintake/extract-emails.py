#!/usr/bin/env python3
"""
Extract public contact emails from law firm websites.
Uses concurrent requests for speed, saves progress incrementally.
"""
import csv
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse
import requests
from time import sleep

INPUT = "law-firms-directory.csv"
OUTPUT = "law-firms-directory-with-emails.csv"
PROGRESS_FILE = "email-extraction-progress.csv"

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

# Pages to check for contact info
CONTACT_PATHS = [
    "",
    "/contact",
    "/contact-us",
    "/contact.html",
    "/about",
    "/about-us",
    "/about.html",
]

# Bad email patterns to filter out
BAD_PATTERNS = [
    "example.com", "yourdomain", "domain.com", "email.com",
    "wixpress.com", "sentry.io", "cloudflare", "googleapis",
    "facebook.com", "twitter.com", "linkedin.com", "instagram.com",
    ".png", ".jpg", ".gif", ".webp", ".svg",
    "noreply", "no-reply", "donotreply",
]

# Preferred email prefixes (in order of preference)
PREFERRED_PREFIXES = [
    "intake@", "info@", "contact@", "office@", "mail@",
    "hello@", "inquiries@", "support@", "admin@", "firm@",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

session = requests.Session()
session.headers.update(HEADERS)


def normalize_url(url):
    """Normalize URL to https with no trailing slash."""
    if not isinstance(url, str) or not url.strip():
        return None
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    return url.rstrip("/")


def is_valid_email(email):
    """Filter out garbage emails."""
    email = email.lower()
    if len(email) > 60:
        return False
    if any(bad in email for bad in BAD_PATTERNS):
        return False
    # Must have valid TLD
    domain = email.split("@")[-1]
    if "." not in domain:
        return False
    tld = domain.split(".")[-1]
    if len(tld) < 2 or len(tld) > 6:
        return False
    return True


def extract_emails_from_site(website):
    """Extract emails from a single website."""
    base_url = normalize_url(website)
    if not base_url:
        return []

    parsed = urlparse(base_url)
    domain = parsed.netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]

    emails = set()

    for path in CONTACT_PATHS:
        try:
            url = urljoin(base_url, path)
            r = session.get(url, timeout=8, allow_redirects=True)
            if r.status_code != 200:
                continue

            # Extract emails from page
            found = EMAIL_REGEX.findall(r.text)
            for email in found:
                email = email.lower()
                if is_valid_email(email):
                    # Prefer emails matching the site domain
                    email_domain = email.split("@")[-1]
                    if email_domain.startswith("www."):
                        email_domain = email_domain[4:]
                    emails.add(email)
        except Exception:
            continue

    return list(emails)


def choose_best_email(emails, website_domain):
    """Choose the best email from a list, preferring intake/info/contact."""
    if not emails:
        return ""

    # Normalize domain
    if website_domain:
        website_domain = website_domain.lower()
        if website_domain.startswith("www."):
            website_domain = website_domain[4:]
        if website_domain.startswith("http"):
            website_domain = urlparse(website_domain).netloc
            if website_domain.startswith("www."):
                website_domain = website_domain[4:]

    # First, filter to emails matching the website domain (preferred)
    domain_emails = [e for e in emails if website_domain and website_domain in e.split("@")[-1]]
    candidates = domain_emails if domain_emails else emails

    # Then prefer by prefix
    for prefix in PREFERRED_PREFIXES:
        for email in candidates:
            if email.startswith(prefix):
                return email

    # Fall back to first email matching domain, or first overall
    if domain_emails:
        return domain_emails[0]
    return emails[0]


def process_firm(row):
    """Process a single firm and return the row with email added."""
    website = row.get("website", "")
    firm_name = row.get("firm_name", "")

    try:
        emails = extract_emails_from_site(website)
        best_email = choose_best_email(emails, website)
        row["email"] = best_email
        row["all_emails"] = "|".join(emails) if emails else ""
        status = "found" if best_email else "none"
    except Exception as e:
        row["email"] = ""
        row["all_emails"] = ""
        status = "error"

    return row, status, firm_name


def main():
    # Read input CSV
    with open(INPUT, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Processing {len(rows)} firms...")
    print()

    results = []
    stats = {"found": 0, "none": 0, "error": 0}

    # Process with thread pool (10 concurrent requests)
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(process_firm, row): i for i, row in enumerate(rows)}

        for future in as_completed(futures):
            idx = futures[future]
            try:
                row, status, firm_name = future.result()
                results.append((idx, row))
                stats[status] += 1

                # Progress output
                total = len(results)
                if row["email"]:
                    print(f"[{total:>3}/{len(rows)}] ✓ {firm_name[:40]:<40} → {row['email']}")
                else:
                    print(f"[{total:>3}/{len(rows)}] ✗ {firm_name[:40]:<40} → (no email)")

                # Save progress every 50 firms
                if total % 50 == 0:
                    sorted_results = sorted(results, key=lambda x: x[0])
                    save_results([r[1] for r in sorted_results])

            except Exception as e:
                print(f"[{idx}] Error: {e}")

    # Sort by original order and save final results
    results.sort(key=lambda x: x[0])
    final_rows = [r[1] for r in results]
    save_results(final_rows)

    print()
    print("=" * 60)
    print(f"Complete! Results saved to {OUTPUT}")
    print(f"  Found email: {stats['found']} ({100*stats['found']/len(rows):.1f}%)")
    print(f"  No email:    {stats['none']} ({100*stats['none']/len(rows):.1f}%)")
    print(f"  Errors:      {stats['error']} ({100*stats['error']/len(rows):.1f}%)")


def save_results(rows):
    """Save results to CSV."""
    if not rows:
        return
    fieldnames = list(rows[0].keys())
    with open(OUTPUT, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
