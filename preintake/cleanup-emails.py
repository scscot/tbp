#!/usr/bin/env python3
"""
Clean up garbage/placeholder emails from the law firms CSV.
"""
import csv
import re

INPUT = "law-firms-directory-with-emails.csv"
OUTPUT = "law-firms-directory-with-emails.csv"  # Overwrite in place

# Garbage email patterns to remove entirely
GARBAGE_EMAILS = [
    "info@gmail.com",
    "jonedoe@lawfirm.com",
    "filler@godaddy.com",
    "email@emailaddress.com",
    "email@address.com",
    "spam@mail.com",
    "example@mysite.com",
    "support@avadacorporate.com",
    "corporate@avadacorporate.com",
    "sales@avadacorporate.com",
    "info@electriclemonade.com",  # Web dev company
    "info@latinotype.com",  # Font company
    "team@latofonts.com",  # Font company
    "impallari@gmail.com",  # Font designer
    "hi@typemade.mx",  # Font company
    "lemonad@jovanny.ru",  # Random
    "hello@rfuenzalida.com",  # Random
    "matt@pixelspread.com",  # Web dev
    "chris@webplant.media",  # Web dev
    "service@atom.com",  # Generic
    "george@unbundledlaw.com",  # Not the firm
    "amanamritmehta@gmail.com",  # Personal gmail
    "ka.dingle@yahoo.com",  # Personal yahoo
    "kammlm147@gmail.com",  # Personal gmail
    "eisenberglawofficesmadison@gmail.com",  # Gmail, not professional
    "calliope22llc@gmail.com",  # Personal gmail
    "alan@pilawyerapp.com",  # App developer
    "misserincanning@gmail.com",  # Personal
    "glendiam@gmail.com",  # Personal
    "webinquiry@firmwise.net",  # Web form
    "contact@9thsouthlaw.com",  # Wrong firm
    "dave@bradshaw.net",  # Wrong person
]

# Prefixes that indicate malformed emails (Unicode escapes)
MALFORMED_PREFIXES = [
    "u003e",  # Unicode > character
    "u003c",  # Unicode < character
    "%20",    # URL encoded space
]


def clean_email(email):
    """Clean a single email, returning None if it should be removed."""
    if not email:
        return None

    email = email.strip().lower()

    # Remove if in garbage list
    if email in GARBAGE_EMAILS:
        return None

    # Fix or remove malformed emails
    for prefix in MALFORMED_PREFIXES:
        if email.startswith(prefix):
            # Try to fix by removing the prefix
            fixed = email[len(prefix):]
            if "@" in fixed and "." in fixed.split("@")[-1]:
                return fixed
            return None

    return email


def clean_all_emails(all_emails_str):
    """Clean a pipe-separated list of emails."""
    if not all_emails_str:
        return ""

    emails = all_emails_str.split("|")
    cleaned = []
    for email in emails:
        clean = clean_email(email)
        if clean:
            cleaned.append(clean)

    return "|".join(cleaned)


def choose_best_email(all_emails_str):
    """Choose the best email from cleaned list."""
    if not all_emails_str:
        return ""

    emails = all_emails_str.split("|")

    # Prefer intake, info, contact, office prefixes
    prefixes = ["intake@", "info@", "contact@", "office@", "mail@", "hello@", "help@"]
    for prefix in prefixes:
        for email in emails:
            if email.startswith(prefix):
                return email

    return emails[0] if emails else ""


def main():
    # Read input
    with open(INPUT, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    cleaned_count = 0
    fixed_count = 0

    for row in rows:
        original_email = row.get("email", "")
        original_all = row.get("all_emails", "")

        # Clean all_emails first
        cleaned_all = clean_all_emails(original_all)
        row["all_emails"] = cleaned_all

        # Choose best email from cleaned list
        if cleaned_all:
            row["email"] = choose_best_email(cleaned_all)
        else:
            row["email"] = ""

        # Track changes
        if original_email and not row["email"]:
            cleaned_count += 1
            print(f"REMOVED: {row['firm_name'][:40]:<40} → {original_email}")
        elif original_email != row["email"] and row["email"]:
            fixed_count += 1
            print(f"FIXED:   {row['firm_name'][:40]:<40} → {original_email} → {row['email']}")

    # Save output
    fieldnames = list(rows[0].keys())
    with open(OUTPUT, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print()
    print("=" * 60)
    print(f"Cleaned {cleaned_count} garbage emails")
    print(f"Fixed {fixed_count} malformed emails")

    # Count final stats
    with_email = sum(1 for r in rows if r["email"])
    print(f"Final: {with_email} firms with valid emails ({100*with_email/len(rows):.1f}%)")


if __name__ == "__main__":
    main()
