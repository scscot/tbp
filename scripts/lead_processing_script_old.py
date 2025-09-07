#!/usr/bin/env python3
"""
lead_processing_script.py

Generates a CSV of leads via Gemini on Vertex AI, then post-filters to keep ONLY
free-email domains and drop role inboxes before appending to ~/tbp/leads/my_leads.csv.

Requirements (in your virtualenv):
  pip uninstall -y google-generativeai google-ai-generativelanguage
  pip install -U google-genai pandas
  gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,openid,https://www.googleapis.com/auth/userinfo.email

Env (set these in your terminal session before running):
  export GOOGLE_CLOUD_PROJECT=teambuilder-plus-fe74d
  export GOOGLE_CLOUD_LOCATION=global
"""

import os
import re
import sys
import pathlib
from io import StringIO

import pandas as pd
from google import genai
from google.genai import types


# ====== Configuration ======
MODEL = "gemini-2.5-flash"

PROMPT_FILENAME = "leads_prompt.txt"  # Must sit next to this script

TMP_DIR = pathlib.Path.home() / "tbp" / "tmp"
OUT_DIR = pathlib.Path.home() / "tbp" / "leads"
OUT_FILE = OUT_DIR / "my_leads.csv"

# Only allow these free-email domains (lowercase compare)
FREE_EMAIL_DOMAINS = {
    "gmail.com", "outlook.com", "live.com", "msn.com",
    "yahoo.com", "icloud.com", "me.com", "mac.com",
}

# Drop addresses with these role-like prefixes (local-part begins with any of these; case-insensitive)
ROLE_PREFIXES = {
    "info", "support", "contact", "sales", "admin", "hello",
    "privacy", "legal", "careers", "team", "office",
}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ====== Helpers ======
def log(msg: str) -> None:
    """Prints a message to the console."""
    print(msg, flush=True)


def require_env(var: str) -> str:
    """Gets an environment variable or raises an error if it's missing."""
    val = os.getenv(var, "").strip()
    if not val:
        raise RuntimeError(f"Missing required environment var: {var}")
    return val


def get_client() -> genai.client.Client:
    """Create a Vertex AI-backed Gen AI client with explicit project/location."""
    project = require_env("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "global").strip() or "global"
    log(f"Using project={project}, location={location}, model={MODEL}")

    # This explicit initialization is the key fix. It forces the SDK to use the
    # Vertex AI backend, removing all ambiguity.
    client = genai.Client(
        vertexai=True,  # critical: route to Vertex AI, not Google AI for Developers
        project=project,
        location=location,
        http_options=types.HttpOptions(api_version="v1"),
    )
    return client


def read_prompt_file() -> str:
    """Read the prompt text from a file next to this script."""
    script_dir = pathlib.Path(__file__).resolve().parent
    prompt_path = script_dir / PROMPT_FILENAME
    if not prompt_path.exists():
        raise FileNotFoundError(
            f"Prompt file not found: {prompt_path}\n"
            f"Place your prompt text in this file."
        )
    text = prompt_path.read_text(encoding="utf-8").strip()
    if not text:
        raise RuntimeError(f"Prompt file is empty: {prompt_path}")
    log(f"Prompt loaded from: {prompt_path}")
    return text


def generate_csv_text(client: genai.client.Client, prompt_text: str) -> str:
    """
    Ask the model to return ONLY CSV with exactly two headers:
    first_name last_name,email
    """
    log("Executing lead generation prompt via Google Gen AI SDK (Vertex)...")

    system_hint = (
        "Return ONLY CSV text with headers exactly:\n"
        "first_name last_name,email\n"
        "No preface or commentary."
    )

    resp = client.models.generate_content(
        model=MODEL,
        contents=[system_hint, prompt_text],
    )
    csv_text = (getattr(resp, "text", None) or "").strip()

    # Sanity check: must start with the exact header
    expected_header = "first_name last_name,email"
    if not csv_text.lower().startswith(expected_header):
        raise RuntimeError(
            "Model output did not start with the expected CSV header.\n"
            "Got first 120 chars:\n" + csv_text[:120]
        )
    return csv_text


def write_tmp_csv(csv_text: str) -> pathlib.Path:
    """Writes the generated CSV text to a temporary file for inspection."""
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    tmp_csv = TMP_DIR / "rep_contacts_temp.csv"
    tmp_csv.write_text(csv_text, encoding="utf-8")
    log(f"Wrote model CSV to: {tmp_csv}")
    return tmp_csv


def read_csv_to_df(path_or_text) -> pd.DataFrame:
    """Read CSV from a path or string; validate required two-column header."""
    if isinstance(path_or_text, pathlib.Path):
        df = pd.read_csv(path_or_text)
    else:
        df = pd.read_csv(StringIO(str(path_or_text)))

    # Require exactly the two columns, in order
    expected = ["first_name last_name", "email"]
    cols = [c.strip() for c in df.columns.tolist()]
    if cols != expected:
        raise RuntimeError(f"Unexpected columns: {cols}. Expected: {expected}")
    return df


def normalize_name(n: str) -> str:
    """Title-case names and collapse whitespace. Keep diacritics/hyphens."""
    n = re.sub(r"\s+", " ", (n or "").strip())
    t = n.title()
    tokens = t.split()
    # Keep common surname particles lowercased in the middle
    particles = {"De", "Del", "Della", "Da", "Di", "Van", "Von", "Der", "Den", "La", "Le", "Du", "St.", "St", "Bin", "Al", "El"}
    if len(tokens) > 2:
        for i in range(1, len(tokens) - 1):
            if tokens[i] in particles:
                tokens[i] = tokens[i].lower()
    return " ".join(tokens)


def post_filter(df: pd.DataFrame) -> pd.DataFrame:
    """Keep only free-email domains and drop role inboxes; drop invalid/blank emails; dedupe by email (case-insensitive)."""
    if df.empty:
        return df

    # Strip whitespace and standardize names
    df = df.copy()
    df["email"] = df["email"].astype(str).str.strip()
    df["first_name last_name"] = df["first_name last_name"].astype(str).map(normalize_name)

    # 1) Drop invalid emails
    valid_mask = df["email"].apply(lambda e: bool(EMAIL_RE.match(e)))
    before = len(df)
    df = df[valid_mask]
    log(f"Filtered invalid emails: {before - len(df)} removed")

    # 2) Keep only allowed free-email domains
    def is_allowed_domain(e: str) -> bool:
        try:
            domain = e.split("@", 1)[1].lower()
        except IndexError:
            return False
        return domain in FREE_EMAIL_DOMAINS

    before = len(df)
    df = df[df["email"].apply(is_allowed_domain)]
    log(f"Filtered to free-email domains: {before - len(df)} removed")

    # 3) Drop role inboxes by local-part prefix
    def is_role_inbox(e: str) -> bool:
        local = e.split("@", 1)[0].lower()
        return any(local.startswith(pref) for pref in ROLE_PREFIXES)

    before = len(df)
    df = df[~df["email"].apply(is_role_inbox)]
    log(f"Dropped role inboxes: {before - len(df)} removed")

    # 4) Dedupe by email (case-insensitive), keep first
    before = len(df)
    df = df.loc[~df["email"].str.lower().duplicated()].copy()
    log(f"Deduped by email: {before - len(df)} removed")

    return df.reset_index(drop=True)


def append_to_my_leads(df: pd.DataFrame) -> None:
    """Append filtered leads to ~/tbp/leads/my_leads.csv (create if missing)."""
    if df.empty:
        log("No leads to append after filtering.")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    header_needed = not OUT_FILE.exists() or OUT_FILE.stat().st_size == 0
    log(f"Appending {len(df)} leads to {OUT_FILE}...")
    df.to_csv(OUT_FILE, mode="a", header=header_needed, index=False)
    log("Successfully appended new leads.")


def main() -> int:
    """Main execution function."""
    try:
        prompt_text = read_prompt_file()
        client = get_client()

        csv_text = generate_csv_text(client, prompt_text)
        tmp_csv_path = write_tmp_csv(csv_text)

        log(f"Reading new leads from {tmp_csv_path}...")
        df_raw = read_csv_to_df(tmp_csv_path)

        log(f"Raw rows: {len(df_raw)}")
        df_filtered = post_filter(df_raw)
        log(f"Kept rows after filtering: {len(df_filtered)}")

        append_to_my_leads(df_filtered)
        log("Done.")
        return 0

    except Exception as e:
        log(f"The script failed to complete. Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

