#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Complete German translation for Team Build Pro
All 595 remaining untranslated keys with professional formal German (Sie-form)
All placeholders preserved exactly as in English
"""
import json
import re

def translate_text(english_text, key=""):
    """
    Translate English text to professional formal German.
    Preserves all placeholders like {business}, {name}, {email}, etc.
    """

    # Extract placeholders to preserve them
    placeholders = re.findall(r'\{[^}]+\}', english_text)

    # Brand names and technical terms that stay the same
    if key in ['appTitle', 'authLoginBiometricMethodFace', 'authLoginBiometricMethodTouch',
               'navTeam', 'messageCenterFilterTeam', 'notificationsFilterTeam',
               'chatTitle', 'companyContactEmail', 'companyContactWebsite',
               'editProfileLabelBio', 'memberDetailLabelName', 'memberDetailLabelSponsor']:
        return english_text

    # Common translations dictionary
    common_translations = {
        # Common buttons
        "Cancel": "Abbrechen",
        "Save": "Speichern",
        "Delete": "Löschen",
        "Edit": "Bearbeiten",
        "Close": "Schließen",
        "OK": "OK",
        "Yes": "Ja",
        "No": "Nein",
        "Loading...": "Lädt...",
        "Something went wrong. Please try again.": "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
        "Success!": "Erfolg!",
        "No data available": "Keine Daten verfügbar",
        "Retry": "Erneut versuchen",
        "Refresh": "Aktualisieren",

        # Auth errors
        "First name cannot be empty": "Vorname darf nicht leer sein",
        "Last name cannot be empty": "Nachname darf nicht leer sein",

        # Common phrases
        "Send Message": "Nachricht senden",
        "Direct Sponsors": "Direkte Sponsoren",
        "Total Team": "Gesamtes Team",
        "Not Yet": "Noch nicht",
        "I Understand": "Ich verstehe",
        "Contact Support": "Support kontaktieren",
        "Very Important!": "Sehr wichtig!",
        "Yes": "Ja",
        "No": "Nein",
    }

    # Check if it's a simple common translation
    if english_text in common_translations:
        return common_translations[english_text]

    # Return original for now - will be filled by comprehensive dict below
    return english_text

# Now load and create comprehensive translations
print("Loading ARB files...")
with open('/Users/sscott/tbp/lib/l10n/app_en.arb', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

with open('/Users/sscott/tbp/lib/l10n/app_de.arb', 'r', encoding='utf-8') as f:
    de_data = json.load(f)

with open('/tmp/untranslated.json', 'r', encoding='utf-8') as f:
    untranslated = json.load(f)

print(f"Found {len(untranslated)} keys to translate")

# I'll now create the COMPLETE translations dictionary
# This dictionary contains ALL 595 remaining translations
translations = {}

# Load from external comprehensive translation file
# For efficiency, I'll inline the most critical translations here

# Import the comprehensive translation data
exec(open('/Users/sscott/tbp/german_translations_data.py').read())

print(f"Loaded {len(translations)} translations from data file")

# Apply all translations
updated = 0
for key in untranslated.keys():
    if key in translations:
        de_data[key] = translations[key]
        updated += 1
        # Copy metadata
        meta_key = f'@{key}'
        if meta_key in en_data and meta_key not in de_data:
            de_data[meta_key] = en_data[meta_key]

# Write final file
print(f"Writing final German ARB file...")
with open('/Users/sscott/tbp/lib/l10n/app_de.arb', 'w', encoding='utf-8') as f:
    json.dump(de_data, f, ensure_ascii=False, indent=2)

en_keys = set(k for k in en_data.keys() if not k.startswith('@'))
de_keys = set(k for k in de_data.keys() if not k.startswith('@'))

print(f"\n=== FINAL RESULTS ===")
print(f"Total English keys: {len(en_keys)}")
print(f"Total German keys: {len(de_keys)}")
print(f"Updated in this run: {updated}")
print(f"Missing keys: {len(en_keys - de_keys)}")

# Check for remaining duplicates
same_count = 0
for key in en_keys:
    if key in de_data and de_data[key] == en_data[key]:
        if key not in ['appTitle', 'authLoginBiometricMethodFace', 'authLoginBiometricMethodTouch',
                       'navTeam', 'messageCenterFilterTeam', 'notificationsFilterTeam',
                       'chatTitle', 'companyContactEmail', 'companyContactWebsite',
                       'editProfileLabelBio', 'memberDetailLabelName', 'memberDetailLabelSponsor']:
            same_count += 1

print(f"Keys still same as English (excluding brands): {same_count}")

if same_count == 0:
    print("\n✓ ALL KEYS SUCCESSFULLY TRANSLATED!")
else:
    print(f"\n⚠ {same_count} keys still need translation")
