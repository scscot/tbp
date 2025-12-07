#!/usr/bin/env python3
"""
Fix script to remove conflicting mobile menu handlers from HTML files.

The components.js now handles the mobile menu toggle with the 'open' class,
but some files still have inline scripts that use the 'active' class,
which causes conflicts.

This script removes the conflicting mobile menu handler blocks.
"""

import os
import re
import sys
import argparse

# Directories to process
DIRS_TO_PROCESS = [
    'web',
    'web-es',
    'web-pt',
    'web-de'
]

# Pattern to match the conflicting mobile menu handler block
# Matches variations of the mobile menu toggle with 'active' class
MOBILE_MENU_PATTERN = r'''
      // Mobile menu
      if \(menuBtn && mobileMenu\) \{
        menuBtn\.addEventListener\('click', function\(\) \{
          const isExpanded = menuBtn\.getAttribute\('aria-expanded'\) === 'true';
          menuBtn\.setAttribute\('aria-expanded', !isExpanded\);
          mobileMenu\.classList\.toggle\('active'\);
        \}\);
      \}
'''

# Alternative pattern (more flexible)
MOBILE_MENU_PATTERN_FLEX = r'''      // Mobile menu\s*\n      if \(menuBtn && mobileMenu\) \{\s*\n        menuBtn\.addEventListener\('click', function\(\) \{\s*\n          const isExpanded = menuBtn\.getAttribute\('aria-expanded'\) === 'true';\s*\n          menuBtn\.setAttribute\('aria-expanded', !isExpanded\);\s*\n          mobileMenu\.classList\.toggle\('active'\);\s*\n        \}\);\s*\n      \}'''

def remove_conflicting_menu_handler(content):
    """Remove the conflicting mobile menu handler from the content."""
    # Pattern to match the entire mobile menu block (with or without comment)
    # Matches the if block with mobileMenu.classList.toggle('active')
    patterns = [
        # With "// Mobile menu" comment
        r"\n\s*// Mobile menu\s*\n\s*if \(menuBtn && mobileMenu\) \{\s*\n\s*menuBtn\.addEventListener\('click', function\(\) \{\s*\n\s*const isExpanded = menuBtn\.getAttribute\('aria-expanded'\) === 'true';\s*\n\s*menuBtn\.setAttribute\('aria-expanded', !isExpanded\);\s*\n\s*mobileMenu\.classList\.toggle\('active'\);\s*\n\s*\}\);\s*\n\s*\}",
        # Without comment (just the if block)
        r"\n\s*if \(menuBtn && mobileMenu\) \{\s*\n\s*menuBtn\.addEventListener\('click', function\(\) \{\s*\n\s*const isExpanded = menuBtn\.getAttribute\('aria-expanded'\) === 'true';\s*\n\s*menuBtn\.setAttribute\('aria-expanded', !isExpanded\);\s*\n\s*mobileMenu\.classList\.toggle\('active'\);\s*\n\s*\}\);\s*\n\s*\}"
    ]

    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            # Remove the matched block
            new_content = content[:match.start()] + content[match.end():]
            return new_content, True

    return content, False

def process_file(filepath, dry_run=False):
    """Process a single HTML file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        original_content = f.read()

    content = original_content

    # Check if file has the conflicting pattern
    if "mobileMenu.classList.toggle('active')" not in content:
        return None, []

    content, changed = remove_conflicting_menu_handler(content)

    if not changed:
        return None, []

    if not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return content, ['Removed conflicting mobile menu handler']

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
    parser = argparse.ArgumentParser(description='Fix conflicting mobile menu handlers')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without modifying files')
    parser.add_argument('--file', type=str, help='Process a single file')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed output')
    args = parser.parse_args()

    # Determine base directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)

    if args.file:
        files = [args.file]
    else:
        files = find_html_files(base_dir, DIRS_TO_PROCESS)

    print(f"{'[DRY RUN] ' if args.dry_run else ''}Scanning {len(files)} files...\n")

    processed = 0
    skipped = 0
    errors = 0

    for filepath in sorted(files):
        rel_path = os.path.relpath(filepath, base_dir)

        try:
            content, changes = process_file(filepath, dry_run=args.dry_run)

            if changes:
                processed += 1
                print(f"{'[DRY RUN] ' if args.dry_run else ''}Fixed: {rel_path}")
                if args.verbose:
                    for change in changes:
                        print(f"  - {change}")
            else:
                skipped += 1
                if args.verbose:
                    print(f"Skipped: {rel_path}")
        except Exception as e:
            errors += 1
            print(f"ERROR processing {rel_path}: {e}")

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Summary:")
    print(f"  Fixed: {processed}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {errors}")

    if args.dry_run:
        print("\nRun without --dry-run to apply changes.")

if __name__ == '__main__':
    main()
