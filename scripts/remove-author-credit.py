#!/usr/bin/env python3
"""
Remove "Created by Stephen Scott" author credit line from all footers.
"""

import os
import re
import glob

BASE_PATH = "/Users/sscott/tbp"

# Patterns for different versions of the author credit line
PATTERNS = [
    # English version
    r'\s*<p style="margin-top: 8px; font-size: 0\.85rem;"><a href="https://www\.stephenscott\.us" rel="author" style="color: #888;">Created by Stephen Scott</a></p>',
    # Spanish version
    r'\s*<p style="margin-top: 8px; font-size: 0\.85rem;"><a href="https://www\.stephenscott\.us" rel="author" style="color: #888;">Creado por Stephen Scott</a></p>',
    # Portuguese version
    r'\s*<p style="margin-top: 8px; font-size: 0\.85rem;"><a href="https://www\.stephenscott\.us" rel="author" style="color: #888;">Criado por Stephen Scott</a></p>',
    # German version
    r'\s*<p style="margin-top: 8px; font-size: 0\.85rem;"><a href="https://www\.stephenscott\.us" rel="author" style="color: #888;">Erstellt von Stephen Scott</a></p>',
]

def remove_author_credit(file_path):
    """Remove author credit line from a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    for pattern in PATTERNS:
        content = re.sub(pattern, '', content)

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def main():
    # Find all HTML files in web/, web-es/, web-pt/, web-de/
    directories = [
        "web",
        "web-es",
        "web-pt",
        "web-de"
    ]

    total_fixed = 0

    for dir_name in directories:
        dir_path = os.path.join(BASE_PATH, dir_name)
        if not os.path.exists(dir_path):
            print(f"Directory not found: {dir_path}")
            continue

        # Find all HTML files (including subdirectories like blog/)
        html_files = glob.glob(os.path.join(dir_path, "**/*.html"), recursive=True)
        print(f"\n{dir_name.upper()}: Found {len(html_files)} HTML files")

        for html_file in html_files:
            rel_path = os.path.relpath(html_file, BASE_PATH)
            if remove_author_credit(html_file):
                print(f"  Fixed: {rel_path}")
                total_fixed += 1

    print(f"\n{'='*50}")
    print(f"Total files fixed: {total_fixed}")


if __name__ == "__main__":
    main()
