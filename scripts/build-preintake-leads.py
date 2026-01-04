#!/usr/bin/env python3
"""
PreIntake.ai Lead Generation Pipeline - Email Extraction Only

This script extracts emails from law firm websites in the directory CSV.
Justia scraping is now done manually via parse-justia-html.py.

Environment Variables:
    EXTRACT_BATCH_SIZE - Number of email extractions to attempt (default: 100)

Usage:
    python scripts/build-preintake-leads.py
"""
import csv
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse
import requests

# ---------- Configuration ----------
EXTRACT_BATCH_SIZE = int(os.environ.get('EXTRACT_BATCH_SIZE', '100'))

# File paths (relative to repo root)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
PREINTAKE_DIR = os.path.join(REPO_ROOT, 'preintake')

DIRECTORY_CSV = os.path.join(PREINTAKE_DIR, 'law-firms-directory.csv')
EMAILS_CSV = os.path.join(PREINTAKE_DIR, 'law-firms-directory-with-emails.csv')
SUMMARY_JSON = os.path.join(SCRIPT_DIR, 'lead-gen-summary.json')

# Email extraction config
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
CONTACT_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us"]
BAD_EMAIL_PATTERNS = [
    "example.com", "yourdomain", "domain.com", "email.com",
    "wixpress.com", "sentry.io", "cloudflare", "googleapis",
    "facebook.com", "twitter.com", "linkedin.com", "instagram.com",
    ".png", ".jpg", ".gif", ".webp", ".svg",
    "noreply", "no-reply", "donotreply",
    "avadacorporate.com", "pilawyerapp.com", "latofonts.com",  # Third-party service providers
    "unbundledlaw.com",  # Legal services platform, not firm domains
]
PREFERRED_PREFIXES = [
    "intake@", "info@", "contact@", "office@", "mail@",
    "hello@", "inquiries@", "support@", "admin@", "firm@",
]

# Garbage emails to always remove
GARBAGE_EMAILS = {
    "info@gmail.com", "jonedoe@lawfirm.com", "filler@godaddy.com",
    "email@emailaddress.com", "email@address.com", "spam@mail.com",
    "example@mysite.com", "support@avadacorporate.com",
    "info@electriclemonade.com", "info@latinotype.com",
}

# Session setup
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})

# ---------- Summary tracking ----------
summary = {
    "run_date": datetime.now().isoformat(),
    "extract": {"success": 0, "failed": 0, "skipped": 0, "total_pending": 0},
    "total_firms": 0,
    "firms_with_emails": 0,
}


# ---------- Helpers ----------
def norm_domain(url):
    """Normalize URL to domain only."""
    try:
        p = urlparse(url if url.startswith('http') else f'https://{url}')
        host = (p.netloc or "").lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def safe_get(url, timeout=15):
    """Make HTTP request with error handling."""
    try:
        r = session.get(url, timeout=timeout, allow_redirects=True)
        r.raise_for_status()
        return r.text, None
    except requests.exceptions.Timeout:
        return None, "Timeout"
    except Exception as e:
        return None, str(e)


# ---------- Email Extraction ----------
def is_valid_email(email):
    """Check if email is valid (not garbage)."""
    email = email.lower()
    if len(email) > 60:
        return False
    if any(bad in email for bad in BAD_EMAIL_PATTERNS):
        return False
    if email in GARBAGE_EMAILS:
        return False
    domain = email.split("@")[-1]
    if "." not in domain:
        return False
    tld = domain.split(".")[-1]
    return 2 <= len(tld) <= 6


def extract_emails_from_site(website):
    """Extract emails from a website."""
    base_url = website if website.startswith('http') else f'https://{website}'
    base_url = base_url.rstrip('/')

    emails = set()
    for path in CONTACT_PATHS:
        url = urljoin(base_url, path)
        html, error = safe_get(url, timeout=8)
        if error or not html:
            continue

        found = EMAIL_REGEX.findall(html)
        for email in found:
            email = email.lower()
            if is_valid_email(email):
                emails.add(email)

    return list(emails)


def choose_best_email(emails, website_domain):
    """Choose the best email from a list."""
    if not emails:
        return ""

    # Prefer emails matching website domain
    domain_emails = [e for e in emails if website_domain and website_domain in e.split("@")[-1]]
    candidates = domain_emails if domain_emails else emails

    # Prefer by prefix
    for prefix in PREFERRED_PREFIXES:
        for email in candidates:
            if email.startswith(prefix):
                return email

    return domain_emails[0] if domain_emails else emails[0]


def process_firm_email(row):
    """Extract email for a single firm."""
    website = row.get("website", "")
    domain = norm_domain(website)

    try:
        emails = extract_emails_from_site(website)
        best = choose_best_email(emails, domain)
        return {
            "email": best,
            "all_emails": "|".join(emails),
            "status": "success" if best else "failed"
        }
    except Exception:
        return {"email": "", "all_emails": "", "status": "failed"}


def extract_emails(rows):
    """Extract emails from firms that need it."""
    print("\n" + "="*60)
    print("Extracting emails from firm websites")
    print("="*60)

    # Find rows that need email extraction
    today = datetime.now().strftime("%Y-%m-%d")
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

    to_extract = []
    for i, row in enumerate(rows):
        status = row.get("extraction_status", "pending")
        attempted = row.get("extraction_attempted", "")

        # Skip if already successful
        if status == "success":
            continue

        # Skip if failed within last 30 days
        if status == "failed" and attempted >= thirty_days_ago:
            summary["extract"]["skipped"] += 1
            continue

        to_extract.append((i, row))
        if len(to_extract) >= EXTRACT_BATCH_SIZE:
            break

    summary["extract"]["total_pending"] = len(to_extract)
    print(f"Found {len(to_extract)} firms needing email extraction (batch limit: {EXTRACT_BATCH_SIZE})")

    if not to_extract:
        print("No firms to process.")
        return rows

    # Process with thread pool
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(process_firm_email, row): (i, row) for i, row in to_extract}

        for future in as_completed(futures):
            idx, row = futures[future]
            result = future.result()

            rows[idx]["email"] = result["email"]
            rows[idx]["all_emails"] = result["all_emails"]
            rows[idx]["extraction_attempted"] = today
            rows[idx]["extraction_status"] = result["status"]

            if result["status"] == "success":
                summary["extract"]["success"] += 1
                print(f"  [OK] {row['firm_name'][:40]} -> {result['email']}")
            else:
                summary["extract"]["failed"] += 1
                print(f"  [--] {row['firm_name'][:40]} -> (no email found)")

    return rows


# ---------- Main Pipeline ----------
def main():
    print("="*60)
    print("PreIntake.ai Lead Generation - Email Extraction")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Extract batch size: {EXTRACT_BATCH_SIZE}")
    print("="*60)

    # Check if directory CSV exists
    if not os.path.exists(DIRECTORY_CSV):
        print(f"\nERROR: Directory CSV not found: {DIRECTORY_CSV}")
        print("Run parse-justia-html.py first to populate the directory.")
        return

    # Load directory
    with open(DIRECTORY_CSV, 'r') as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)

    summary["total_firms"] = len(all_rows)
    print(f"\nTotal firms in directory: {len(all_rows)}")

    # Count existing emails
    existing_emails = sum(1 for r in all_rows if r.get("extraction_status") == "success")
    print(f"Firms with emails already: {existing_emails}")

    # Extract emails
    all_rows = extract_emails(all_rows)

    # Save with emails
    email_fieldnames = ["firm_name", "website", "practice_area", "state",
                        "scraped_date", "extraction_attempted", "extraction_status",
                        "email", "all_emails"]

    with open(EMAILS_CSV, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=email_fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    # Also update directory CSV with extraction status
    dir_fieldnames = ["firm_name", "website", "practice_area", "state",
                      "scraped_date", "extraction_attempted", "extraction_status"]
    with open(DIRECTORY_CSV, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=dir_fieldnames)
        writer.writeheader()
        for row in all_rows:
            writer.writerow({k: row.get(k, '') for k in dir_fieldnames})

    # Calculate final counts
    summary["firms_with_emails"] = sum(1 for r in all_rows if r.get("extraction_status") == "success")

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total firms in directory: {summary['total_firms']}")
    print(f"Emails extracted this run: {summary['extract']['success']}")
    print(f"Failed extractions: {summary['extract']['failed']}")
    print(f"Skipped (recently failed): {summary['extract']['skipped']}")
    print(f"Total firms with emails: {summary['firms_with_emails']}")

    # Save summary for notification script
    with open(SUMMARY_JSON, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"\nSummary saved to: {SUMMARY_JSON}")
    print(f"Emails CSV saved to: {EMAILS_CSV}")


if __name__ == "__main__":
    main()
