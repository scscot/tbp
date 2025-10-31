#!/usr/bin/env python3
"""
Remove redundant note boxes from company pages
"""

import re
from pathlib import Path

COMPANIES_DIR = Path("/Users/sscott/tbp/web/companies")

def remove_note_box(content):
    """Remove the note box section"""
    # Pattern to match the entire note div
    pattern = r'\s*<div class="note">.*?</div>\s*\n'
    content = re.sub(pattern, '\n', content, flags=re.DOTALL)
    return content

def process_file(file_path):
    """Process a single file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if '<div class="note">' in content:
        content = remove_note_box(content)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"✅ Removed note box from: {file_path.name}")
        return True
    else:
        print(f"⏭️  No note box found: {file_path.name}")
        return False

def main():
    """Main execution"""
    print("=" * 60)
    print("Removing Note Boxes from Company Pages")
    print("=" * 60)

    company_files = sorted(COMPANIES_DIR.glob("ai-recruiting-*.html"))
    print(f"\n📊 Found {len(company_files)} company pages\n")

    removed_count = 0
    for file_path in company_files:
        if process_file(file_path):
            removed_count += 1

    print("\n" + "=" * 60)
    print(f"✅ Removed note boxes from {removed_count}/{len(company_files)} files")
    print("=" * 60)

if __name__ == "__main__":
    main()
