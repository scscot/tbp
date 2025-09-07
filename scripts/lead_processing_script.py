#!/usr/bin/env python3
"""
lead_processing_script.py — Verified ingestion with Base URL injection (hardened I/O)

Key fixes in this version:
- Parse CLI args BEFORE creating the client or logging (so --model shows correctly).
- Snapshot raw model output to ~/tbp/tmp/rep_contacts_raw_*.txt even on failure.
- Coerce model output to CSV by stripping code fences and trimming to the strict header line.
- Keep: template + url-range injection, strict schema, on-page verification, filters, dedupe, audit.
"""

import os
import re
import sys
import time
import pathlib
from io import StringIO

import pandas as pd
import requests
from google import genai
from google.genai import types

# ===== Config =====
MODEL = os.getenv("GENAI_MODEL", "gemini-2.5-flash")
PROMPT_TEMPLATE_FILENAME = "leads_prompt_template.txt"   # preferred (contains {{BASE_URLS}})
PROMPT_FALLBACK_FILENAME = "leads_prompt.txt"            # used if template not found
BASE_URLS_FILENAME = "base_urls.txt"                     # one URL per line

HOME = pathlib.Path.home()
TMP_DIR = HOME / "tbp" / "tmp"
OUT_DIR = HOME / "tbp" / "leads"
OUT_FILE = OUT_DIR / "my_leads.csv"
OUT_AUDIT = OUT_DIR / "my_leads_sources.csv"

FREE_EMAIL_DOMAINS = {
    "gmail.com","outlook.com","live.com","msn.com","yahoo.com","icloud.com","me.com","mac.com"
}
ROLE_PREFIXES = {"info","support","contact","sales","admin","hello","privacy","legal","careers","team","office"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SYSTEM_HINT = (
    "Return ONLY CSV text with headers exactly:\n"
    "first_name last_name,email,source_url\n"
    "No preface or commentary."
)

# ===== Helpers =====
def log(msg: str) -> None:
    print(msg, flush=True)

def require_env(var: str) -> str:
    val = os.getenv(var, "").strip()
    if not val:
        raise RuntimeError(f"Missing required env var: {var}")
    return val

def get_client(active_model: str) -> genai.Client:
    project = require_env("GOOGLE_CLOUD_PROJECT")
    location = "global"  # Vertex Gemini uses global
    log(f"Using project={project}, location={location}, model={active_model}")
    return genai.Client(
        vertexai=True,
        project=project,
        location=location,
        http_options=types.HttpOptions(api_version="v1"),
    )

def load_text(path: pathlib.Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    txt = path.read_text(encoding="utf-8").strip()
    if not txt:
        raise RuntimeError(f"File is empty: {path}")
    return txt

def load_base_urls(script_dir: pathlib.Path) -> list[str]:
    p = script_dir / BASE_URLS_FILENAME
    if not p.exists():
        return []
    raw = p.read_text(encoding="utf-8")
    urls = []
    for line in raw.replace(",", "\n").splitlines():
        u = line.strip()
        if u:
            urls.append(u)
    return urls

def parse_url_range(arg: str | None, n_total: int) -> tuple[int, int]:
    if not arg:
        return (0, n_total)
    m = re.match(r"^\s*(\d+)\s*-\s*(\d+)\s*$", arg)
    if not m:
        return (0, n_total)
    start = max(1, int(m.group(1)))
    end = max(start, int(m.group(2)))
    return (start-1, min(end, n_total))

def build_prompt(script_dir: pathlib.Path, template: str | None, url_range: str | None) -> str:
    # Choose template or fallback prompt
    if template:
        tmpl_path = script_dir / template
    else:
        tmpl_path = script_dir / PROMPT_TEMPLATE_FILENAME

    if tmpl_path.exists():
        tmpl = load_text(tmpl_path)
        use_template = True
    else:
        # Fallback to static prompt
        tmpl_path = script_dir / PROMPT_FALLBACK_FILENAME
        tmpl = load_text(tmpl_path)
        use_template = False

    # Inject Base URLs when template has {{BASE_URLS}}
    if use_template and "{{BASE_URLS}}" in tmpl:
        all_urls = load_base_urls(script_dir)
        if not all_urls:
            raise RuntimeError("base_urls.txt is missing or empty, but template expects {{BASE_URLS}}.")
        s, e = parse_url_range(url_range, len(all_urls))
        selected = all_urls[s:e]
        log(f"Injected Base URLs [{s+1}-{e}] ({len(selected)} items).")
        tmpl = tmpl.replace("{{BASE_URLS}}", ", ".join(selected))
    else:
        if use_template:
            log("Template provided but no {{BASE_URLS}} placeholder found; sending as-is.")
        else:
            log(f"Using static prompt: {tmpl_path.name}")

    return tmpl

def call_model(client: genai.Client, active_model: str, prompt_text: str, tries: int = 3, backoff: float = 1.5) -> str:
    last_err: Exception | None = None
    for i in range(tries):
        try:
            resp = client.models.generate_content(model=active_model, contents=[SYSTEM_HINT, prompt_text])
            return (getattr(resp, "text", None) or "").strip()
        except Exception as e:
            last_err = e
            if i == tries - 1:
                raise
            time.sleep(backoff ** i)
    raise RuntimeError(str(last_err) if last_err else "Unknown model error")

def snapshot_raw_text(text: str) -> pathlib.Path:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    p = TMP_DIR / f"rep_contacts_raw_{time.strftime('%Y%m%d-%H%M%S')}.txt"
    p.write_text(text, encoding="utf-8")
    log(f"Raw model output saved: {p}")
    return p

def coerce_to_csv_text(text: str) -> str | None:
    """Strip code fences, trim leading junk, and return substring starting at the strict header."""
    t = text.strip()
    # Remove Markdown fences if present
    t = re.sub(r"^```[a-zA-Z0-9]*\s*", "", t)
    t = re.sub(r"\s*```\s*$", "", t)

    header = "first_name last_name,email,source_url"
    idx = t.lower().find(header)
    if idx == -1:
        return None
    return t[idx:]

def snapshot_csv(csv_text: str) -> pathlib.Path:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    p = TMP_DIR / f"rep_contacts_{time.strftime('%Y%m%d-%H%M%S')}.csv"
    p.write_text(csv_text, encoding="utf-8")
    log(f"Snapshot saved: {p}")
    return p

def read_csv_strict(path_or_text) -> pd.DataFrame:
    if isinstance(path_or_text, pathlib.Path):
        df = pd.read_csv(path_or_text)
    else:
        df = pd.read_csv(StringIO(str(path_or_text)))
    expected = ["first_name last_name", "email", "source_url"]
    cols = [c.strip() for c in df.columns.tolist()]
    if cols != expected:
        raise RuntimeError(f"Unexpected columns: {cols}. Expected: {expected}")
    return df

def normalize_name(n: str) -> str:
    n = re.sub(r"\s+", " ", (n or "").strip())
    t = n.title()
    toks = t.split()
    particles = {"De","Del","Della","Da","Di","Van","Von","Der","Den","La","Le","Du","St.","St","Bin","Al","El"}
    if len(toks) > 2:
        for i in range(1, len(toks) - 1):
            if toks[i] in particles:
                toks[i] = toks[i].lower()
    return " ".join(toks)

def is_free_domain(e: str) -> bool:
    try:
        return e.split("@", 1)[1].lower() in FREE_EMAIL_DOMAINS
    except Exception:
        return False

def is_role_inbox(e: str) -> bool:
    local = e.split("@", 1)[0].lower()
    return any(local.startswith(pref) for pref in ROLE_PREFIXES)

def is_synth_local(name: str, email: str) -> bool:
    # Obvious constructions: firstlast, first.last, first_last, flast, firstl (+ optional single digit)
    name = normalize_name(name)
    parts = name.split()
    first = re.sub(r"[^a-z0-9]", "", parts[0].lower()) if parts else ""
    last  = re.sub(r"[^a-z0-9]", "", parts[-1].lower()) if len(parts) >= 2 else ""
    lp = email.split("@", 1)[0].lower()
    cands = {first+last, f"{first}.{last}", f"{first}_{last}", first[:1]+last, first+last[:1]}
    if lp in cands:
        return True
    for d in "0123456789":
        if lp in {first+last+d, f"{first}.{last}{d}", f"{first}_{last}{d}"}:
            return True
    return False

def verify_source(name: str, email: str, url: str, timeout: int = 12) -> tuple[bool, str]:
    """Fetch URL and confirm both the exact email and the name tokens exist in page text."""
    try:
        r = requests.get(url, headers={"User-Agent":"Mozilla/5.0 (LeadVerifier/1.0)"}, timeout=timeout, allow_redirects=True)
        if r.status_code != 200 or not r.text:
            return (False, f"http_{r.status_code}")
        html = r.text.lower()
        if email.lower() not in html:
            return (False, "email_not_found")
        nm = normalize_name(name).lower().split()
        if len(nm) >= 2:
            if nm[0] not in html or nm[-1] not in html:
                return (False, "name_tokens_missing")
        return (True, "ok")
    except requests.RequestException as e:
        return (False, f"http_error:{e.__class__.__name__}")

def post_filter_and_verify(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = df.copy()
    df["first_name last_name"] = df["first_name last_name"].map(normalize_name)
    df["email"] = df["email"].astype(str).str.strip()
    df["source_url"] = df["source_url"].astype(str).str.strip()

    # Basic filters
    df = df[df["email"].apply(lambda e: bool(EMAIL_RE.match(e)))]
    df = df[df["email"].apply(is_free_domain)]
    df = df[~df["email"].apply(is_role_inbox)]
    df = df.loc[~df["email"].str.lower().duplicated()].copy()

    audits, kept = [], []
    for _, row in df.iterrows():
        name, email, url = row["first_name last_name"], row["email"], row["source_url"]
        verified, reason = verify_source(name, email, url)
        synth = is_synth_local(name, email)
        keep = bool(verified)  # only keep if verified
        audits.append({"first_name last_name":name, "email":email, "source_url":url,
                       "verified": keep, "synthetic_like": bool(synth), "status": reason})
        if keep:
            kept.append({"first_name last_name":name, "email":email})

    vdf = pd.DataFrame(kept, columns=["first_name last_name","email"])
    adf = pd.DataFrame(audits, columns=["first_name last_name","email","source_url","verified","synthetic_like","status"])
    return vdf, adf

def append_outputs(verified_df: pd.DataFrame, audit_df: pd.DataFrame) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Cross-file dedupe by email
    if OUT_FILE.exists() and not verified_df.empty:
        existing = pd.read_csv(OUT_FILE)
        mask = ~verified_df["email"].str.lower().isin(existing["email"].astype(str).str.lower())
        verified_df = verified_df[mask].copy()

    if not verified_df.empty:
        header = not OUT_FILE.exists()
        verified_df.to_csv(OUT_FILE, mode="a", header=header, index=False)
        log(f"Appended {len(verified_df)} verified leads -> {OUT_FILE}")
    else:
        log("No new verified leads to append.")

    if not audit_df.empty:
        audit_header = not OUT_AUDIT.exists()
        audit_df.to_csv(OUT_AUDIT, mode="a", header=audit_header, index=False)
        log(f"Wrote audit rows: {len(audit_df)} -> {OUT_AUDIT}")

def main() -> int:
    try:
        # ---- Parse CLI args FIRST (so MODEL is correct in logs) ----
        template = None
        url_range = None
        active_model = MODEL
        for a in sys.argv[1:]:
            if a.startswith("--model="):
                active_model = a.split("=",1)[1]
            elif a.startswith("--template="):
                template = a.split("=",1)[1]
            elif a.startswith("--url-range="):
                url_range = a.split("=",1)[1]
            elif a.startswith("--base-urls-file="):
                global BASE_URLS_FILENAME
                BASE_URLS_FILENAME = a.split("=",1)[1]

        # Build prompt text (inject Base URLs if template used)
        script_dir = pathlib.Path(__file__).resolve().parent
        prompt_text = build_prompt(script_dir, template, url_range)

        # Create client AFTER we know the final model (for accurate banner)
        client = get_client(active_model)

        # Model call
        text = call_model(client, active_model, prompt_text)

        # Always snapshot raw text for debugging
        raw_path = snapshot_raw_text(text)

        # Coerce to CSV (strip fences, trim to strict header)
        csv_text = coerce_to_csv_text(text)
        if not csv_text:
            prev = text[:200].replace("\n","\\n")
            raise RuntimeError(f"Model output did not contain the expected header. Raw saved: {raw_path} | Preview: {prev}")

        snap = snapshot_csv(csv_text)

        df = read_csv_strict(snap)
        log(f"Raw rows: {len(df)}")

        verified_df, audit_df = post_filter_and_verify(df)
        log(f"Verified rows kept: {len(verified_df)}")

        append_outputs(verified_df, audit_df)
        log("Done.")
        return 0
    except Exception as e:
        log(f"Script failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
