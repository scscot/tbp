#!/usr/bin/env python3
"""
Fix HTML Issues in Company Pages

Fixes:
1. HTML Syntax Error: <ol class="checklist"> id="getting-started-list">
   → <ol class="checklist" id="getting-started-list">
2. Button Spacing: Add equal margin-bottom to toggle button
"""

import re
import sys
from pathlib import Path

COMPANIES_DIR = Path("/Users/sscott/tbp/web/companies")

def fix_ol_syntax_error(content):
    """Fix malformed <ol> tag with missing < and extra space"""
    # Pattern: <ol class="checklist"> id="getting-started-list">
    # Should be: <ol class="checklist" id="getting-started-list">
    old_pattern = r'<ol class="checklist">\s+id="getting-started-list">'
    new_text = r'<ol class="checklist" id="getting-started-list">'

    content = re.sub(old_pattern, new_text, content)
    return content

def fix_button_spacing(content):
    """Add equal margin-bottom to toggle button to match margin-top"""
    # Find the toggle button div and add margin-bottom: 1.5rem
    # Currently has: margin-top: 1.5rem
    # Need to add: margin-bottom: 1.5rem

    old_pattern = r'(<div style="text-align: center; margin-top: 1\.5rem;">)'
    new_text = r'<div style="text-align: center; margin: 1.5rem 0;">'

    content = re.sub(old_pattern, new_text, content)
    return content

def extract_company_name(content):
    """Extract company name from H1 title"""
    match = re.search(r'<h1>AI Recruiting for (.+?) Distributors</h1>', content)
    if match:
        return match.group(1)

    match = re.search(r'<h1>AI Recruiting for (.+?) Independent Business Owners</h1>', content)
    if match:
        return match.group(1)

    match = re.search(r'<h1>AI Recruiting for (.+?)</h1>', content)
    if match:
        name = match.group(1)
        name = re.sub(r'\s+(Distributors|Representatives|Independent Business Owners|Consultants|Agents)$', '', name)
        return name

    return "Unknown Company"

def process_file(file_path, dry_run=False):
    """Process a single company page file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    company_name = extract_company_name(content)
    print(f"\n📄 Processing: {file_path.name}")
    print(f"   Company: {company_name}")

    original_content = content
    changes = []

    # Apply fixes
    content = fix_ol_syntax_error(content)
    if content != original_content:
        changes.append("✓ Fixed <ol> syntax error")
        original_content = content

    content = fix_button_spacing(content)
    if content != original_content:
        changes.append("✓ Fixed button spacing")

    if dry_run:
        if changes:
            for change in changes:
                print(f"   {change}")
        else:
            print(f"   ⏭️  No changes needed")
    else:
        if changes:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            for change in changes:
                print(f"   {change}")
            print(f"   ✅ Updated successfully")
        else:
            print(f"   ⏭️  No changes needed")

    return bool(changes)

def main():
    """Main execution function"""
    dry_run = '--dry-run' in sys.argv

    print("=" * 60)
    print("Fix HTML Issues in Company Pages")
    print("=" * 60)

    if dry_run:
        print("\n🔍 DRY RUN MODE - No files will be modified\n")
    else:
        print("\n⚠️  LIVE MODE - Files will be modified\n")

    # Find all company pages
    company_files = sorted(COMPANIES_DIR.glob("ai-recruiting-*.html"))
    print(f"📊 Found {len(company_files)} company pages\n")

    # Process all files
    updated_count = 0
    for file_path in company_files:
        try:
            if process_file(file_path, dry_run):
                updated_count += 1
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")

    print("\n" + "=" * 60)
    print(f"✅ Updated {updated_count}/{len(company_files)} files")

    if dry_run:
        print("\n💡 Run without --dry-run to apply changes")

    print("=" * 60)

if __name__ == "__main__":
    main()
