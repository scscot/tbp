#!/usr/bin/env python3
"""
Company Pages CTA Optimization Script

This script updates all company pages with:
1. Hero CTA section with app store badges
2. Mid-content CTA interrupt section
3. Replaced primary CTA buttons with app badges
4. "Read More" collapse on Getting Started section
5. Reduced Related Companies to 3 cards
6. Updated cache buster to v=8

Usage:
    python3 update_company_pages.py --dry-run  # Preview changes
    python3 update_company_pages.py            # Apply changes
"""

import os
import re
import sys
import glob
import shutil
from pathlib import Path

# Directories
WEB_DIR = Path("/Users/sscott/tbp/web")
COMPANIES_DIR = WEB_DIR / "companies"
BACKUP_DIR = WEB_DIR / "backup_company_pages"

# Hero CTA Template (will replace {COMPANY_NAME})
HERO_CTA_TEMPLATE = '''
      <!-- Hero CTA Section -->
      <section class="hero-cta-section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 1rem; padding: 2.5rem 2rem; margin: 2rem 0; text-align: center; color: white;">
        <h2 style="color: white; font-size: 1.75rem; margin-bottom: 0.5rem;">Start Building Your {COMPANY_NAME} Team Today</h2>
        <p style="color: rgba(255,255,255,0.95); font-size: 1.125rem; margin-bottom: 1.5rem;">Join {COMPANY_NAME} distributors using AI to recruit smarter and build faster</p>
        <div class="download-buttons" style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 1rem;">
          <a href="https://apps.apple.com/app/team-build-pro/id6751211622" class="app-store-badge" style="display: inline-block; transition: transform 0.2s;">
            <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" style="height: 60px;" onmouseover="this.parentElement.style.transform='translateY(-2px)'" onmouseout="this.parentElement.style.transform='translateY(0)'" />
          </a>
          <a href="#" class="google-play-badge" style="display: inline-block; transition: transform 0.2s;" onclick="event.preventDefault(); alert('Android version coming soon! We\\'ll notify you when it\\'s available.');">
            <img src="/assets/images/Google-Play.png" alt="Get it on Google Play" style="height: 60px;" onmouseover="this.parentElement.style.transform='translateY(-2px)'" onmouseout="this.parentElement.style.transform='translateY(0)'" />
          </a>
        </div>
        <div style="font-size: 0.875rem; color: rgba(255,255,255,0.9); font-weight: 500;">
          Free 30-day trial · $4.99/mo · Cancel anytime
        </div>
      </section>
'''

# Mid-content CTA Template (will replace {COMPANY_NAME})
MID_CTA_TEMPLATE = '''
      <!-- Mid-Content CTA Interrupt -->
      <section style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 1rem; padding: 2rem; margin: 2.5rem 0; text-align: center; color: white; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
        <h3 style="color: white; font-size: 1.5rem; margin-bottom: 1rem; margin-top: 0;">Ready to Start Building Your {COMPANY_NAME} Team?</h3>
        <div style="margin-bottom: 1.5rem;">
          <ul style="list-style: none; padding: 0; margin: 0; text-align: left; display: inline-block; color: rgba(255,255,255,0.95); line-height: 2;">
            <li>✓ Pre-building advantage: Prospects build teams before joining</li>
            <li>✓ AI Coach guidance: Personalized coaching and milestone roadmaps</li>
            <li>✓ Real-time network visibility: Track your entire organization</li>
          </ul>
        </div>
        <div class="download-buttons" style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 1rem;">
          <a href="https://apps.apple.com/app/team-build-pro/id6751211622" class="app-store-badge" style="display: inline-block; transition: transform 0.2s;">
            <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" style="height: 60px;" onmouseover="this.parentElement.style.transform='translateY(-2px)'" onmouseout="this.parentElement.style.transform='translateY(0)'" />
          </a>
          <a href="#" class="google-play-badge" style="display: inline-block; transition: transform 0.2s;" onclick="event.preventDefault(); alert('Android version coming soon! We\\'ll notify you when it\\'s available.');">
            <img src="/assets/images/Google-Play.png" alt="Get it on Google Play" style="height: 60px;" onmouseover="this.parentElement.style.transform='translateY(-2px)'" onmouseout="this.parentElement.style.transform='translateY(0)'" />
          </a>
        </div>
        <div style="font-size: 0.875rem; color: rgba(255,255,255,0.9);">
          Free 30-day trial · $4.99/mo · Cancel anytime
        </div>
      </section>
'''

# Primary CTA App Badges Template
PRIMARY_CTA_BADGES = '''        <div style="margin: 2rem 0; text-align: center;">
          <div class="download-buttons" style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 1rem;">
            <a href="https://apps.apple.com/app/team-build-pro/id6751211622" class="app-store-badge" style="display: inline-block; transition: transform 0.2s;">
              <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" style="height: 60px;" onmouseover="this.parentElement.style.transform='translateY(-2px)'" onmouseout="this.parentElement.style.transform='translateY(0)'" />
            </a>
            <a href="#" class="google-play-badge" style="display: inline-block; transition: transform 0.2s;" onclick="event.preventDefault(); alert('Android version coming soon! We\\'ll notify you when it\\'s available.');">
              <img src="/assets/images/Google-Play.png" alt="Get it on Google Play" style="height: 60px;" onmouseover="this.parentElement.style.transform='translateY(-2px)'" onmouseout="this.parentElement.style.transform='translateY(0)'" />
            </a>
          </div>
          <div style="font-size: 0.875rem; color: #64748b; font-weight: 500;">
            Free 30-day trial · $4.99/mo · Cancel anytime
          </div>
        </div>'''

# JavaScript for collapse functionality
COLLAPSE_SCRIPT = '''
    // Getting Started collapse/expand functionality
    const toggleBtn = document.getElementById('toggle-roadmap-btn');
    const collapsibleItems = document.querySelectorAll('.collapsible-item');
    let isExpanded = false;

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        isExpanded = !isExpanded;
        collapsibleItems.forEach(item => {
          item.style.display = isExpanded ? 'list-item' : 'none';
        });
        toggleBtn.textContent = isExpanded
          ? 'Hide Extended Roadmap'
          : 'Show Full 30-Day Roadmap (7 more steps)';
      });
    }'''


def extract_company_name(content):
    """Extract company name from H1 title"""
    # Try "Distributors" first
    match = re.search(r'<h1>AI Recruiting for (.+?) Distributors</h1>', content)
    if match:
        return match.group(1)

    # Try "Independent Business Owners"
    match = re.search(r'<h1>AI Recruiting for (.+?) Independent Business Owners</h1>', content)
    if match:
        return match.group(1)

    # Try any other pattern
    match = re.search(r'<h1>AI Recruiting for (.+?)</h1>', content)
    if match:
        # Remove trailing words like "Distributors", "Representatives", etc.
        name = match.group(1)
        name = re.sub(r'\s+(Distributors|Representatives|Independent Business Owners|Consultants|Agents)$', '', name)
        return name

    return "Unknown Company"


def backup_files():
    """Create backup of all company pages"""
    if not BACKUP_DIR.exists():
        BACKUP_DIR.mkdir(parents=True)
        print(f"✅ Created backup directory: {BACKUP_DIR}")

    company_files = list(COMPANIES_DIR.glob("ai-recruiting-*.html"))
    for file in company_files:
        backup_file = BACKUP_DIR / file.name
        shutil.copy2(file, backup_file)

    print(f"✅ Backed up {len(company_files)} company pages to {BACKUP_DIR}")


def add_hero_cta(content, company_name):
    """Add Hero CTA section after intro note"""
    hero_cta = HERO_CTA_TEMPLATE.replace('{COMPANY_NAME}', company_name)

    # Find the note box and insert Hero CTA after it
    pattern = r'(</div>\s*\n\s*)(      <section>)'
    replacement = r'\1' + hero_cta + r'\n\2'

    # Only replace the first occurrence (after intro note)
    content = re.sub(pattern, replacement, content, count=1)
    return content


def add_mid_cta(content, company_name):
    """Add Mid-content CTA after Training & Onboarding section"""
    mid_cta = MID_CTA_TEMPLATE.replace('{COMPANY_NAME}', company_name)

    # Find Training section end and insert Mid CTA after it
    pattern = r'(</section>\s*\n\s*)(      <section>\s*\n\s*<h2>Your AI Recruiting Playbook)'
    replacement = r'\1' + mid_cta + r'\n\2'

    content = re.sub(pattern, replacement, content)
    return content


def replace_primary_cta_buttons(content):
    """Replace primary CTA text buttons with app store badges"""
    # Match the paragraph with both btn-primary and btn-outline buttons
    old_pattern = r'        <p>\s*\n\s*<a class="btn btn-primary"[^>]*>Try Team Build Pro Free for 30 Days</a>\s*\n\s*&nbsp;\s*\n\s*<a class="btn btn-outline"[^>]*>Download on iOS</a>\s*\n\s*</p>'

    content = re.sub(old_pattern, PRIMARY_CTA_BADGES, content, flags=re.DOTALL)
    return content


def add_collapse_to_getting_started(content):
    """Add collapse functionality to Getting Started section"""
    # Add classes to list items
    content = re.sub(
        r'(<ol class="checklist">)\s*\n\s*(<li>)',
        r'\1 id="getting-started-list">\n          <li class="always-visible">',
        content
    )

    # Mark first 3 items as always-visible, rest as collapsible
    lines = content.split('\n')
    li_count = 0
    in_getting_started = False

    for i, line in enumerate(lines):
        if 'id="getting-started-list"' in line:
            in_getting_started = True
        elif in_getting_started and '<li>' in line:
            li_count += 1
            if li_count > 3:
                lines[i] = line.replace('<li>', '<li class="collapsible-item" style="display: none;">')
            elif li_count <= 3 and 'class="always-visible"' not in line:
                lines[i] = line.replace('<li>', '<li class="always-visible">')
        elif in_getting_started and '</ol>' in line:
            in_getting_started = False

    content = '\n'.join(lines)

    # Add toggle button after the list
    button_html = '''        <div style="text-align: center; margin-top: 1.5rem;">
          <button id="toggle-roadmap-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 0.5rem; padding: 12px 24px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            Show Full 30-Day Roadmap (7 more steps)
          </button>
        </div>'''

    # Insert button after Getting Started list's closing </ol>
    pattern = r'(</ol>\s*\n)(      </section>\s*\n\s*<section class="card">)'
    replacement = r'\1' + button_html + r'\n\2'
    content = re.sub(pattern, replacement, content)

    return content


def add_collapse_script(content):
    """Add JavaScript for collapse functionality"""
    # Find the existing script section and add collapse code before closing
    pattern = r'(document\.getElementById\(\'currentYear\'\)\.textContent = new Date\(\)\.getFullYear\(\);)\s*\n(\s*</script>)'
    replacement = r'\1\n' + COLLAPSE_SCRIPT + r'\n\2'

    content = re.sub(pattern, replacement, content)
    return content


def reduce_related_companies(content):
    """Reduce Related Companies section to 3 cards"""
    # Find the Related Companies section and keep only first 3 cards
    pattern = r'(<h3>Related Company Recruiting Guides</h3>.*?<div class="grid-2">)(.*?)(</div>\s*</section>)'

    def keep_first_3_cards(match):
        header = match.group(1)
        cards_section = match.group(2)
        footer = match.group(3)

        # Extract all card divs
        card_pattern = r'(<div class="card">.*?</div>)'
        cards = re.findall(card_pattern, cards_section, flags=re.DOTALL)

        if len(cards) > 3:
            # Keep only first 3 cards
            new_cards = '\n          '.join(cards[:3])
            return header + '\n          ' + new_cards + '\n        ' + footer

        return match.group(0)

    content = re.sub(pattern, keep_first_3_cards, content, flags=re.DOTALL)
    return content


def update_cache_buster(content):
    """Update CSS cache buster from v=6 to v=8"""
    content = re.sub(r'style\.css\?v=6', 'style.css?v=8', content)
    return content


def process_file(file_path, dry_run=False):
    """Process a single company page file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract company name
    company_name = extract_company_name(content)

    print(f"\n📄 Processing: {file_path.name}")
    print(f"   Company: {company_name}")

    # Apply transformations
    original_content = content
    content = add_hero_cta(content, company_name)
    content = add_mid_cta(content, company_name)
    content = replace_primary_cta_buttons(content)
    content = add_collapse_to_getting_started(content)
    content = add_collapse_script(content)
    content = reduce_related_companies(content)
    content = update_cache_buster(content)

    if dry_run:
        # Show changes summary
        changes = []
        if 'hero-cta-section' in content and 'hero-cta-section' not in original_content:
            changes.append("✓ Added Hero CTA")
        if 'Mid-Content CTA Interrupt' in content and 'Mid-Content CTA Interrupt' not in original_content:
            changes.append("✓ Added Mid-content CTA")
        if 'app-store-badge' in content and 'btn btn-primary' not in content:
            changes.append("✓ Replaced primary buttons")
        if 'toggle-roadmap-btn' in content and 'toggle-roadmap-btn' not in original_content:
            changes.append("✓ Added collapse to Getting Started")
        if 'v=8' in content and 'v=8' not in original_content:
            changes.append("✓ Updated cache buster")

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
    print("Company Pages CTA Optimization Script")
    print("=" * 60)

    if dry_run:
        print("\n🔍 DRY RUN MODE - No files will be modified\n")
    else:
        print("\n⚠️  LIVE MODE - Files will be modified\n")
        # Create backups
        backup_files()

    # Find all company pages
    company_files = sorted(COMPANIES_DIR.glob("ai-recruiting-*.html"))
    print(f"\n📊 Found {len(company_files)} company pages")

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
    else:
        print(f"\n💾 Backups saved to: {BACKUP_DIR}")

    print("=" * 60)


if __name__ == "__main__":
    main()
