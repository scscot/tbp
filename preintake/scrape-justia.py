#!/usr/bin/env python3
import csv
import re
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ---------- Config ----------
TARGET_ROWS = 500
OUTFILE = "firms_500.csv"

PRACTICE_AREAS = {
    # Justia path segments
    "Personal Injury": "personal-injury",
    "Immigration": "immigration-law",
    "Family Law": "family-law",
    "Bankruptcy": "bankruptcy",
    "Criminal Defense": "criminal-law",
}

# Start with big states to hit volume quickly; add/remove as you like
STATES = [
    "california", "texas", "florida", "new-york", "illinois",
    "pennsylvania", "ohio", "georgia", "north-carolina", "michigan",
    "new-jersey", "virginia", "washington", "arizona", "massachusetts",
]

BASE = "https://www.justia.com/lawyers/"
SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; PreIntakeResearchBot/1.0; +https://preintake.ai)"
})

# ---------- Helpers ----------
def norm_domain(url: str) -> str:
    try:
        p = urlparse(url)
        host = (p.netloc or "").lower()
        host = host[4:] if host.startswith("www.") else host
        return host
    except Exception:
        return ""

def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def safe_get(url: str, timeout=25):
    r = SESSION.get(url, timeout=timeout)
    r.raise_for_status()
    return r.text

def extract_profile_links(listing_html: str, listing_url: str):
    soup = BeautifulSoup(listing_html, "html.parser")

    # Justia listing pages typically have "View Lawyer Profile" links.
    # We'll collect profile URLs that look like /lawyer/ or /lawyers/...
    links = set()
    for a in soup.select("a"):
        href = a.get("href") or ""
        if not href:
            continue
        if "/lawyer/" in href or re.search(r"/lawyers/[^/]+/[^/]+/[^/]+$", href):
            full = urljoin(listing_url, href)
            if full.startswith("https://"):
                links.add(full)
    return sorted(links)

def extract_firm_and_site(profile_html: str, profile_url: str):
    soup = BeautifulSoup(profile_html, "html.parser")

    # Firm name: often shown near the top on profile pages.
    # We search for a prominent firm/company label in headings.
    firm_name = ""
    # Common patterns: h2/h3 text that is not the lawyer name
    # Try a few selectors (this is intentionally tolerant).
    for sel in ["h2", "h3", "div", "span"]:
        for el in soup.select(sel):
            txt = clean_text(el.get_text(" "))
            if not txt:
                continue
            # Heuristic: skip giant blocks and obvious page chrome
            if len(txt) > 80:
                continue
            if any(bad in txt.lower() for bad in [
                "review this lawyer", "badges", "biography", "practice area", "contact"
            ]):
                continue
            # If the text contains "Law Firm" or looks like a firm name, keep it as candidate.
            # (We'll still accept plain firm names without "Law Firm".)
            if "law firm" in txt.lower() or ("llp" in txt.lower()) or ("p.c." in txt.lower()) or ("pllc" in txt.lower()):
                firm_name = txt
                break
        if firm_name:
            break

    # Fallback: if no "LLP/PC/PLLC/Law Firm" found, try a compact element near the top
    if not firm_name:
        top = soup.get_text("\n")
        # crude fallback: find a short line that includes "Law" and isn't the lawyer name header
        candidates = []
        for line in [clean_text(x) for x in top.split("\n")]:
            if 4 <= len(line) <= 70 and "law" in line.lower():
                if "justia" in line.lower():
                    continue
                candidates.append(line)
        firm_name = candidates[0] if candidates else ""

    # Website: Justia frequently includes an external link labeled "Website"
    website = ""
    for a in soup.find_all("a", href=True):
        label = clean_text(a.get_text(" ")).lower()
        href = a["href"]
        if label == "website" and href.startswith("http"):
            website = href
            break

    # If no labeled website, try to find external links in a "Website" section
    if not website:
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("http") and "justia.com" not in href:
                # ignore social links
                if any(s in href.lower() for s in ["facebook.com", "linkedin.com", "twitter.com", "instagram.com", "youtube.com"]):
                    continue
                website = href
                break

    firm_name = clean_text(firm_name)
    website = clean_text(website)

    # If firm name is empty but we have a website, use domain as placeholder
    if not firm_name and website:
        firm_name = norm_domain(website) or ""

    return firm_name, website

# ---------- Main crawl ----------
rows = []
seen_domains = set()

def add_row(practice_area, firm_name, website):
    if not website:
        return False
    dom = norm_domain(website)
    if not dom:
        return False
    if dom in seen_domains:
        return False
    seen_domains.add(dom)
    rows.append({
        "firm_name": firm_name,
        "website": website,
        "practice_area": practice_area,
        "source": "justia.com"
    })
    return True

page_cap_per_state_area = 30  # raise if you want more; 30 pages/state/area is usually plenty

for practice_label, slug in PRACTICE_AREAS.items():
    for state in STATES:
        for page in range(1, page_cap_per_state_area + 1):
            if len(rows) >= TARGET_ROWS:
                break

            listing_url = f"{BASE}{slug}/{state}"
            if page > 1:
                listing_url += f"?page={page}"

            try:
                listing_html = safe_get(listing_url)
            except Exception:
                break

            profile_links = extract_profile_links(listing_html, listing_url)
            if not profile_links:
                break

            for profile_url in profile_links:
                if len(rows) >= TARGET_ROWS:
                    break
                try:
                    prof_html = safe_get(profile_url)
                    firm, site = extract_firm_and_site(prof_html, profile_url)
                    if add_row(practice_label, firm, site):
                        print(f"[{len(rows):>3}] {practice_label} | {firm} | {site}")
                except Exception:
                    continue

                time.sleep(0.3)  # be polite

            time.sleep(0.5)

        if len(rows) >= TARGET_ROWS:
            break
    if len(rows) >= TARGET_ROWS:
        break

# ---------- Write CSV ----------
with open(OUTFILE, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["firm_name", "website", "practice_area", "source"])
    w.writeheader()
    w.writerows(rows)

print(f"\nWrote {len(rows)} rows to {OUTFILE}")
