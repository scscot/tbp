#!/usr/bin/env python3
"""
Add hreflang link tags to all TBP HTML files for multilingual SEO.
Also adds keywords meta tag to homepages.
"""

import os
import re
from pathlib import Path

BASE_DIR = Path('/Users/sscott/tbp')

# Pages that exist in all 4 languages (must have matching paths)
MULTILINGUAL_PAGES = [
    '',  # index.html -> /
    'faq.html',
    'blog.html',
    'books.html',
    'contact_us.html',
    'privacy_policy.html',
    'terms_of_service.html',
    # Blog posts (same slugs across languages)
    'blog/ai-automation-transforms-direct-sales.html',
    'blog/ai-recruiting-best-practices-2025.html',
    'blog/ai-recruiting-platforms-failing-direct-sales.html',
    'blog/qualify-new-recruits-30-days.html',
    'blog/team-build-pro-november-2025-update.html',
    'blog/young-living-recruiting-strategies.html',
    'blog/ai-network-marketing-corporate-field-leaders-use.html',
    'blog/use-ai-mlm-recruiting-without-losing-human-touch.html',
]

# Keywords for homepages
KEYWORDS = {
    'en': 'AI recruiting, direct sales app, MLM recruiting software, downline builder, network marketing AI, team building app, AI coach, direct sales automation',
    'es': 'reclutamiento IA, app ventas directas, software MLM, constructor de redes, marketing multinivel IA, app construcción equipos',
    'pt': 'recrutamento IA, app vendas diretas, software MLM, construtor de equipes, marketing multinível IA, app construção de equipes',
    'de': 'KI Recruiting, Direktvertrieb App, MLM Software, Netzwerk-Builder, Network Marketing KI, Team Building App',
}

def get_hreflang_tags(page_path):
    """Generate hreflang link tags for a page."""
    # Normalize path
    if page_path == '' or page_path == 'index.html':
        en_path = '/'
        other_path = '/'
    else:
        en_path = f'/{page_path}'
        other_path = f'/{page_path}'

    return f'''    <!-- Hreflang tags for multilingual SEO -->
    <link rel="alternate" hreflang="en" href="https://teambuildpro.com{en_path}" />
    <link rel="alternate" hreflang="es" href="https://es.teambuildpro.com{other_path}" />
    <link rel="alternate" hreflang="pt" href="https://pt.teambuildpro.com{other_path}" />
    <link rel="alternate" hreflang="de" href="https://de.teambuildpro.com{other_path}" />
    <link rel="alternate" hreflang="x-default" href="https://teambuildpro.com{en_path}" />'''

def add_hreflang_to_file(file_path, page_path):
    """Add hreflang tags to an HTML file after the canonical tag."""
    content = file_path.read_text(encoding='utf-8')

    # Check if hreflang already exists
    if 'hreflang="en"' in content and '<link rel="alternate"' in content:
        print(f"  Skipping (already has hreflang): {file_path.name}")
        return False

    hreflang_tags = get_hreflang_tags(page_path)

    # Insert after canonical tag
    canonical_pattern = r'(<link rel="canonical"[^>]*>)'
    if re.search(canonical_pattern, content):
        new_content = re.sub(
            canonical_pattern,
            r'\1\n' + hreflang_tags,
            content,
            count=1
        )
        file_path.write_text(new_content, encoding='utf-8')
        print(f"  Added hreflang: {file_path.name}")
        return True
    else:
        print(f"  WARNING: No canonical tag found in {file_path.name}")
        return False

def add_keywords_to_homepage(site_dir, lang):
    """Add keywords meta tag to homepage."""
    index_file = site_dir / 'index.html'
    if not index_file.exists():
        return False

    content = index_file.read_text(encoding='utf-8')

    # Check if keywords already exist
    if 'name="keywords"' in content:
        print(f"  Skipping keywords (already exists): {index_file}")
        return False

    keywords_tag = f'    <meta name="keywords" content="{KEYWORDS[lang]}">'

    # Insert after description meta tag
    desc_pattern = r'(<meta name="description"[^>]*>)'
    if re.search(desc_pattern, content):
        new_content = re.sub(
            desc_pattern,
            r'\1\n' + keywords_tag,
            content,
            count=1
        )
        index_file.write_text(new_content, encoding='utf-8')
        print(f"  Added keywords: {index_file.name}")
        return True
    return False

def main():
    sites = [
        ('web', 'en'),
        ('web-es', 'es'),
        ('web-pt', 'pt'),
        ('web-de', 'de'),
    ]

    total_hreflang = 0
    total_keywords = 0

    for site_name, lang in sites:
        site_dir = BASE_DIR / site_name
        print(f"\n=== Processing {site_name} ({lang}) ===")

        # Add hreflang to multilingual pages
        for page_path in MULTILINGUAL_PAGES:
            if page_path == '':
                file_path = site_dir / 'index.html'
            else:
                file_path = site_dir / page_path

            if file_path.exists():
                if add_hreflang_to_file(file_path, page_path):
                    total_hreflang += 1
            else:
                print(f"  File not found: {file_path}")

        # Add keywords to homepage
        if add_keywords_to_homepage(site_dir, lang):
            total_keywords += 1

    print(f"\n=== Summary ===")
    print(f"Hreflang tags added: {total_hreflang}")
    print(f"Keywords tags added: {total_keywords}")

if __name__ == '__main__':
    main()
