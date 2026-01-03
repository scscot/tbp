#!/usr/bin/env python3
"""
PreIntake.ai Lead Generation Pipeline

Unified script that:
1. Scrapes new law firms from Justia.com
2. Extracts emails from firm websites
3. Cleans garbage emails
4. Outputs summary for notification

Environment Variables:
    SCRAPE_BATCH_SIZE - Number of new firms to scrape (default: 50)
    EXTRACT_BATCH_SIZE - Number of email extractions to attempt (default: 100)

Usage:
    python scripts/build-preintake-leads.py
"""
import csv
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse
import requests
from time import sleep

# ---------- Configuration ----------
SCRAPE_BATCH_SIZE = int(os.environ.get('SCRAPE_BATCH_SIZE', '50'))
EXTRACT_BATCH_SIZE = int(os.environ.get('EXTRACT_BATCH_SIZE', '100'))

# File paths (relative to repo root)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
PREINTAKE_DIR = os.path.join(REPO_ROOT, 'preintake')

DIRECTORY_CSV = os.path.join(PREINTAKE_DIR, 'law-firms-directory.csv')
EMAILS_CSV = os.path.join(PREINTAKE_DIR, 'law-firms-directory-with-emails.csv')
SUMMARY_JSON = os.path.join(SCRIPT_DIR, 'lead-gen-summary.json')

# Practice areas (10 total)
PRACTICE_AREAS = {
    "Personal Injury": "personal-injury",
    "Family Law": "family-law",
    "Criminal Defense": "criminal-law",
    "Immigration": "immigration-law",
    "Bankruptcy": "bankruptcy",
    "Workers' Compensation": "workers-compensation",
    "Employment Law": "employment-law",
    "Social Security Disability": "social-security-disability",
    "Medical Malpractice": "medical-malpractice",
    "Estate Planning": "estate-planning",
}

# All 50 states + DC
STATES = [
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
    "maine", "maryland", "massachusetts", "michigan", "minnesota",
    "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new-hampshire", "new-jersey", "new-mexico", "new-york",
    "north-carolina", "north-dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode-island", "south-carolina", "south-dakota",
    "tennessee", "texas", "utah", "vermont", "virginia", "washington",
    "west-virginia", "wisconsin", "wyoming", "district-of-columbia"
]

JUSTIA_BASE = "https://www.justia.com/lawyers/"

# Email extraction config
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
CONTACT_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us"]
BAD_EMAIL_PATTERNS = [
    "example.com", "yourdomain", "domain.com", "email.com",
    "wixpress.com", "sentry.io", "cloudflare", "googleapis",
    "facebook.com", "twitter.com", "linkedin.com", "instagram.com",
    ".png", ".jpg", ".gif", ".webp", ".svg",
    "noreply", "no-reply", "donotreply",
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
    "User-Agent": "Mozilla/5.0 (compatible; PreIntakeResearchBot/1.0; +https://preintake.ai)"
})

# ---------- Summary tracking ----------
summary = {
    "run_date": datetime.now().isoformat(),
    "scrape": {"new_firms": 0, "skipped_existing": 0, "errors": 0},
    "extract": {"success": 0, "failed": 0, "skipped": 0},
    "practice_areas": {},
    "blocked": False,
    "block_reason": "",
    "new_firms_list": [],
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


def clean_text(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def safe_get(url, timeout=15):
    """Make HTTP request with error handling."""
    try:
        r = session.get(url, timeout=timeout, allow_redirects=True)
        if r.status_code in (403, 429):
            return None, f"HTTP {r.status_code}"
        r.raise_for_status()
        return r.text, None
    except requests.exceptions.Timeout:
        return None, "Timeout"
    except Exception as e:
        return None, str(e)


# ---------- Phase 1: Scrape Justia ----------
def load_existing_domains():
    """Load all existing domains from directory CSV."""
    domains = set()
    if os.path.exists(DIRECTORY_CSV):
        with open(DIRECTORY_CSV, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                domain = norm_domain(row.get('website', ''))
                if domain:
                    domains.add(domain)
    return domains


def extract_profile_links(html, base_url):
    """Extract lawyer profile URLs from Justia listing page."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    links = set()
    for a in soup.select("a"):
        href = a.get("href") or ""
        if "/lawyer/" in href or re.search(r"/lawyers/[^/]+/[^/]+/[^/]+$", href):
            full = urljoin(base_url, href)
            if full.startswith("https://"):
                links.add(full)
    return sorted(links)


def extract_firm_from_profile(html, profile_url):
    """Extract firm name and website from Justia profile page."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")

    # Find firm name
    firm_name = ""
    for sel in ["h2", "h3", "div", "span"]:
        for el in soup.select(sel):
            txt = clean_text(el.get_text(" "))
            if not txt or len(txt) > 80:
                continue
            if any(bad in txt.lower() for bad in ["review this lawyer", "badges", "biography"]):
                continue
            if any(kw in txt.lower() for kw in ["law firm", "llp", "p.c.", "pllc", "law office"]):
                firm_name = txt
                break
        if firm_name:
            break

    # Find website
    website = ""
    for a in soup.find_all("a", href=True):
        label = clean_text(a.get_text(" ")).lower()
        href = a["href"]
        if label == "website" and href.startswith("http"):
            website = href
            break

    if not website:
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("http") and "justia.com" not in href:
                if any(s in href.lower() for s in ["facebook.", "linkedin.", "twitter."]):
                    continue
                website = href
                break

    if not firm_name and website:
        firm_name = norm_domain(website) or ""

    return clean_text(firm_name), website.split('?')[0]  # Remove UTM params


def scrape_justia(existing_domains):
    """Scrape new firms from Justia.com."""
    print("\n" + "="*60)
    print("PHASE 1: Scraping new firms from Justia.com")
    print("="*60)

    new_firms = []
    consecutive_errors = 0

    for practice_label, slug in PRACTICE_AREAS.items():
        if len(new_firms) >= SCRAPE_BATCH_SIZE:
            break

        for state in STATES:
            if len(new_firms) >= SCRAPE_BATCH_SIZE:
                break

            for page in range(1, 10):  # Max 10 pages per state/area
                if len(new_firms) >= SCRAPE_BATCH_SIZE:
                    break

                listing_url = f"{JUSTIA_BASE}{slug}/{state}"
                if page > 1:
                    listing_url += f"?page={page}"

                html, error = safe_get(listing_url)
                if error:
                    if "403" in error or "429" in error:
                        consecutive_errors += 1
                        if consecutive_errors >= 3:
                            summary["blocked"] = True
                            summary["block_reason"] = f"Blocked after {len(new_firms)} firms: {error}"
                            print(f"\n*** BLOCKED BY JUSTIA: {error} ***")
                            return new_firms
                    break

                consecutive_errors = 0
                profile_links = extract_profile_links(html, listing_url)
                if not profile_links:
                    break

                for profile_url in profile_links:
                    if len(new_firms) >= SCRAPE_BATCH_SIZE:
                        break

                    # Get profile page
                    prof_html, prof_error = safe_get(profile_url)
                    if prof_error:
                        summary["scrape"]["errors"] += 1
                        continue

                    firm_name, website = extract_firm_from_profile(prof_html, profile_url)
                    if not website:
                        continue

                    domain = norm_domain(website)
                    if not domain or domain in existing_domains:
                        summary["scrape"]["skipped_existing"] += 1
                        continue

                    # New firm found!
                    existing_domains.add(domain)
                    new_firm = {
                        "firm_name": firm_name,
                        "website": website,
                        "practice_area": practice_label,
                        "state": state.replace("-", " ").title(),
                        "scraped_date": datetime.now().strftime("%Y-%m-%d"),
                        "extraction_attempted": "",
                        "extraction_status": "pending",
                    }
                    new_firms.append(new_firm)
                    summary["scrape"]["new_firms"] += 1
                    summary["practice_areas"][practice_label] = summary["practice_areas"].get(practice_label, 0) + 1
                    summary["new_firms_list"].append({"firm": firm_name, "website": website, "area": practice_label})

                    print(f"[{len(new_firms):>3}] {practice_label} | {firm_name[:35]} | {website}")

                    sleep(2)  # Rate limiting

                sleep(1)  # Between pages

    return new_firms


# ---------- Phase 2: Extract Emails ----------
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
    print("PHASE 2: Extracting emails from firm websites")
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

    print(f"Extracting emails for {len(to_extract)} firms...")

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
    print("PreIntake.ai Lead Generation Pipeline")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Scrape batch: {SCRAPE_BATCH_SIZE}, Extract batch: {EXTRACT_BATCH_SIZE}")
    print("="*60)

    # Load existing data
    existing_domains = load_existing_domains()
    print(f"\nExisting firms in directory: {len(existing_domains)}")

    # Phase 1: Scrape new firms from Justia
    new_firms = scrape_justia(existing_domains)

    if summary["blocked"]:
        print(f"\n*** SCRAPING BLOCKED: {summary['block_reason']} ***")

    # Append new firms to directory CSV
    if new_firms:
        fieldnames = ["firm_name", "website", "practice_area", "state",
                      "scraped_date", "extraction_attempted", "extraction_status"]

        # Read existing rows
        existing_rows = []
        if os.path.exists(DIRECTORY_CSV):
            with open(DIRECTORY_CSV, 'r') as f:
                reader = csv.DictReader(f)
                existing_rows = list(reader)

        # Add new columns to existing rows if missing
        for row in existing_rows:
            for col in ["scraped_date", "extraction_attempted", "extraction_status"]:
                if col not in row:
                    row[col] = ""

        # Combine and save
        all_rows = existing_rows + new_firms
        with open(DIRECTORY_CSV, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_rows)

        print(f"\nAdded {len(new_firms)} new firms to {DIRECTORY_CSV}")
        print(f"Total firms now: {len(all_rows)}")

    # Phase 2: Extract emails
    # Load full directory for email extraction
    with open(DIRECTORY_CSV, 'r') as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)

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

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"New firms scraped: {summary['scrape']['new_firms']}")
    print(f"Skipped (existing): {summary['scrape']['skipped_existing']}")
    print(f"Emails extracted: {summary['extract']['success']}")
    print(f"Email extraction failed: {summary['extract']['failed']}")

    if summary['practice_areas']:
        print("\nPractice Areas:")
        for area, count in sorted(summary['practice_areas'].items(), key=lambda x: -x[1]):
            print(f"  {area}: {count}")

    # Save summary for notification script
    with open(SUMMARY_JSON, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"\nSummary saved to: {SUMMARY_JSON}")

    # Exit with error if blocked
    if summary["blocked"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
