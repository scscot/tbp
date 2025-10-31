#!/usr/bin/env python3
"""
Add "Team Build Pro" Branding to All CTA Sections

Updates:
1. Hero CTA: Add "Team Build Pro app" to subtitle
2. Mid-Content CTA: Add "with Team Build Pro" to headline
3. Primary CTA: Add "app" after "Team Build Pro"
"""

import re
import sys
from pathlib import Path

COMPANIES_DIR = Path("/Users/sscott/tbp/web/companies")

def update_hero_cta(content):
    """Update Hero CTA subtitle to mention Team Build Pro app"""
    old_pattern = r'(using AI to recruit smarter and build faster)'
    new_text = r'using the Team Build Pro app to recruit smarter with AI-powered tools'

    content = re.sub(old_pattern, new_text, content)
    return content

def update_midcontent_cta(content):
    """Update Mid-Content CTA headline to include Team Build Pro"""
    old_pattern = r'(Ready to Start Building Your .+? Team\?)'

    def replace_headline(match):
        original = match.group(1)
        # Replace "Ready to Start Building" with "Ready to Build"
        # Add "with Team Build Pro" before the question mark
        new_headline = original.replace('Ready to Start Building Your', 'Ready to Build Your')
        new_headline = new_headline.replace('?', ' with Team Build Pro?')
        return new_headline

    content = re.sub(old_pattern, replace_headline, content)
    return content

def update_primary_cta(content):
    """Update Primary CTA intro to say 'Team Build Pro app'"""
    old_pattern = r'<p><strong>Team Build Pro</strong> gives'
    new_text = r'<p>The <strong>Team Build Pro app</strong> gives'

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

    # Apply all three updates
    content = update_hero_cta(content)
    content = update_midcontent_cta(content)
    content = update_primary_cta(content)

    if dry_run:
        # Show what changed
        changes = []
        if 'Team Build Pro app to recruit smarter' in content and 'Team Build Pro app to recruit smarter' not in original_content:
            changes.append("✓ Updated Hero CTA subtitle")
        if 'with Team Build Pro?' in content and 'with Team Build Pro?' not in original_content:
            changes.append("✓ Updated Mid-content CTA headline")
        if 'The <strong>Team Build Pro app</strong> gives' in content and 'The <strong>Team Build Pro app</strong> gives' not in original_content:
            changes.append("✓ Updated Primary CTA intro")

        for change in changes:
            print(f"   {change}")
    else:
        # Write changes
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"   ✅ Updated successfully")

    return True

def main():
    """Main execution function"""
    dry_run = '--dry-run' in sys.argv

    print("=" * 60)
    print("Add Team Build Pro Branding to CTAs")
    print("=" * 60)

    if dry_run:
        print("\n🔍 DRY RUN MODE - No files will be modified\n")
    else:
        print("\n⚠️  LIVE MODE - Files will be modified\n")

    # Find all company pages
    company_files = sorted(COMPANIES_DIR.glob("ai-recruiting-*.html"))
    print(f"📊 Found {len(company_files)} company pages\n")

    # Process all files
    success_count = 0
    for file_path in company_files:
        try:
            if process_file(file_path, dry_run):
                success_count += 1
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")

    print("\n" + "=" * 60)
    print(f"✅ Successfully processed {success_count}/{len(company_files)} files")

    if dry_run:
        print("\n💡 Run without --dry-run to apply changes")

    print("=" * 60)

if __name__ == "__main__":
    main()
