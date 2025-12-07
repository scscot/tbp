#!/usr/bin/env python3
"""
Migration script to convert TBP HTML files to use shared components.js

This script:
1. Adds <script src="/js/components.js"></script> to <head>
2. Replaces hardcoded <header>...</header> with <div id="tbp-header"></div>
3. Replaces hardcoded <footer>...</footer> with <div id="tbp-footer"></div>
4. Removes the currentYear script line (components.js handles this)

Usage:
    python3 migrate-to-components.py --dry-run     # Preview changes
    python3 migrate-to-components.py               # Apply changes
    python3 migrate-to-components.py --file path   # Process single file
"""

import os
import re
import sys
import argparse
from pathlib import Path

# Directories to process (relative to project root)
DIRS_TO_PROCESS = [
    'web',
    'web-es',
    'web-pt',
    'web-de'
]

# Files to skip (special cases)
SKIP_FILES = [
    'index.html',           # Homepage has special hero, handle separately
    'faq-test.html',        # Already migrated (test file)
    'firestore-monitor.html', # Admin tool, different structure
    'delete-account.html',  # Minimal page
    'claim.html',           # Different structure
    'claim-google.html',    # Different structure
]

# Pattern to find the components.js script tag
COMPONENTS_SCRIPT = '<script src="/js/components.js"></script>'

# Pattern to match header block (with variations)
HEADER_PATTERNS = [
    # Pattern for standard header with invite bar before it
    r'(\s*<!-- Top Invite Bar.*?-->\s*<div id="top-invite-bar"[^>]*></div>\s*)?(\s*<!-- Header -->)?\s*<header class="header">.*?</header>',
    # Pattern for header without invite bar
    r'(\s*<!-- Header -->)?\s*<header class="header">.*?</header>',
]

# Pattern to match footer block
FOOTER_PATTERN = r'(\s*<!-- Footer.*?-->)?\s*<footer class="footer">.*?</footer>'

# Pattern to match currentYear script line
CURRENT_YEAR_PATTERN = r"\s*document\.getElementById\('currentYear'\)\.textContent = new Date\(\)\.getFullYear\(\);"

def add_components_script(content):
    """Add components.js script tag to head if not already present."""
    if COMPONENTS_SCRIPT in content:
        return content, False

    # Find the closing </head> or last stylesheet link
    # Insert before </head>
    head_close = content.find('</head>')
    if head_close == -1:
        return content, False

    # Find a good insertion point (after last CSS link, before </head>)
    css_pattern = r'<link[^>]*rel="stylesheet"[^>]*>'
    matches = list(re.finditer(css_pattern, content[:head_close]))

    if matches:
        # Insert after last CSS link
        last_css_end = matches[-1].end()
        insert_point = last_css_end

        # Check if there's content between CSS and </head>
        between = content[last_css_end:head_close]

        # Insert the script with proper formatting
        new_content = (
            content[:insert_point] +
            '\n\n    <!-- Shared Header/Footer Components -->\n    ' +
            COMPONENTS_SCRIPT +
            content[insert_point:]
        )
    else:
        # Fallback: insert before </head>
        new_content = (
            content[:head_close] +
            '\n    <!-- Shared Header/Footer Components -->\n    ' +
            COMPONENTS_SCRIPT + '\n' +
            content[head_close:]
        )

    return new_content, True

def replace_header(content):
    """Replace hardcoded header with placeholder div."""
    # Try each pattern
    for pattern in HEADER_PATTERNS:
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if match:
            replacement = '\n    <!-- Header (rendered by components.js) -->\n    <div id="tbp-header"></div>\n'
            new_content = content[:match.start()] + replacement + content[match.end():]
            return new_content, True

    return content, False

def replace_footer(content):
    """Replace hardcoded footer with placeholder div."""
    match = re.search(FOOTER_PATTERN, content, re.DOTALL | re.IGNORECASE)
    if match:
        replacement = '\n    <!-- Footer (rendered by components.js) -->\n    <div id="tbp-footer"></div>\n'
        new_content = content[:match.start()] + replacement + content[match.end():]
        return new_content, True

    return content, False

def remove_current_year_script(content):
    """Remove the currentYear script line since components.js handles it."""
    match = re.search(CURRENT_YEAR_PATTERN, content)
    if match:
        # Remove the line
        new_content = content[:match.start()] + content[match.end():]
        return new_content, True

    return content, False

def process_file(filepath, dry_run=False):
    """Process a single HTML file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        original_content = f.read()

    content = original_content
    changes = []

    # Step 1: Add components.js script
    content, changed = add_components_script(content)
    if changed:
        changes.append('Added components.js script')

    # Step 2: Replace header
    content, changed = replace_header(content)
    if changed:
        changes.append('Replaced header with placeholder')

    # Step 3: Replace footer
    content, changed = replace_footer(content)
    if changed:
        changes.append('Replaced footer with placeholder')

    # Step 4: Remove currentYear script
    content, changed = remove_current_year_script(content)
    if changed:
        changes.append('Removed currentYear script')

    if not changes:
        return None, []

    if not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return content, changes

def find_html_files(base_dir, subdirs):
    """Find all HTML files in specified directories."""
    files = []
    for subdir in subdirs:
        dir_path = os.path.join(base_dir, subdir)
        if not os.path.exists(dir_path):
            continue

        for root, _, filenames in os.walk(dir_path):
            for filename in filenames:
                if filename.endswith('.html'):
                    files.append(os.path.join(root, filename))

    return files

def main():
    parser = argparse.ArgumentParser(description='Migrate TBP HTML files to use shared components.js')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without modifying files')
    parser.add_argument('--file', type=str, help='Process a single file')
    parser.add_argument('--include-index', action='store_true', help='Include index.html files (normally skipped)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed output')
    args = parser.parse_args()

    # Determine base directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)  # Go up from scripts/ to project root

    if args.file:
        files = [args.file]
    else:
        files = find_html_files(base_dir, DIRS_TO_PROCESS)

    # Filter files
    skip_set = set(SKIP_FILES)
    if args.include_index:
        skip_set.discard('index.html')

    files_to_process = []
    for f in files:
        filename = os.path.basename(f)
        if filename not in skip_set:
            files_to_process.append(f)

    print(f"{'[DRY RUN] ' if args.dry_run else ''}Processing {len(files_to_process)} files...\n")

    processed = 0
    skipped = 0
    errors = 0

    for filepath in sorted(files_to_process):
        rel_path = os.path.relpath(filepath, base_dir)

        try:
            content, changes = process_file(filepath, dry_run=args.dry_run)

            if changes:
                processed += 1
                print(f"{'[DRY RUN] ' if args.dry_run else ''}Modified: {rel_path}")
                if args.verbose:
                    for change in changes:
                        print(f"  - {change}")
            else:
                skipped += 1
                if args.verbose:
                    print(f"Skipped (no changes needed): {rel_path}")
        except Exception as e:
            errors += 1
            print(f"ERROR processing {rel_path}: {e}")

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Summary:")
    print(f"  Processed: {processed}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {errors}")

    if args.dry_run:
        print("\nRun without --dry-run to apply changes.")

if __name__ == '__main__':
    main()
