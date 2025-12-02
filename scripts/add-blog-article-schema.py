#!/usr/bin/env python3
"""
Add Article JSON-LD schema to all blog posts for rich snippets in search results.
"""

import os
import re
from pathlib import Path
from datetime import datetime

BASE_DIR = Path('/Users/sscott/tbp')

SITES = ['web', 'web-es', 'web-pt', 'web-de']

def get_article_schema(title, url, date_published):
    """Generate Article JSON-LD schema."""
    return f'''    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "{title}",
      "author": {{
        "@type": "Person",
        "name": "Stephen Scott",
        "url": "https://www.stephenscott.us"
      }},
      "publisher": {{
        "@type": "Organization",
        "name": "Team Build Pro",
        "logo": {{
          "@type": "ImageObject",
          "url": "https://teambuildpro.com/assets/icons/team-build-pro.png"
        }}
      }},
      "datePublished": "{date_published}",
      "dateModified": "{date_published}",
      "image": "https://teambuildpro.com/assets/icons/team-build-pro.png",
      "mainEntityOfPage": {{
        "@type": "WebPage",
        "@id": "{url}"
      }}
    }}
    </script>'''

def extract_title(content):
    """Extract title from HTML."""
    match = re.search(r'<title>([^<]+)</title>', content)
    if match:
        # Clean up title - remove site name suffix
        title = match.group(1)
        title = re.sub(r'\s*\|\s*Team Build Pro.*$', '', title)
        return title.strip()
    return "Team Build Pro Blog"

def extract_canonical_url(content):
    """Extract canonical URL from HTML."""
    match = re.search(r'<link rel="canonical" href="([^"]+)"', content)
    if match:
        return match.group(1)
    return ""

def extract_date(content, file_path):
    """Try to extract date from content or use file modification date."""
    # Try to find date in content (common patterns)
    date_patterns = [
        r'datePublished["\']?\s*[:=]\s*["\']?(\d{4}-\d{2}-\d{2})',
        r'(\d{4}-\d{2}-\d{2})',
        r'(November|December|October|September)\s+\d{1,2},?\s+\d{4}',
    ]

    for pattern in date_patterns:
        match = re.search(pattern, content)
        if match:
            date_str = match.group(1)
            # Convert month name to ISO format if needed
            if any(month in date_str for month in ['November', 'December', 'October', 'September']):
                try:
                    dt = datetime.strptime(date_str.replace(',', ''), '%B %d %Y')
                    return dt.strftime('%Y-%m-%d')
                except:
                    pass
            elif re.match(r'\d{4}-\d{2}-\d{2}', date_str):
                return date_str

    # Default to November 2025 for recent blog posts
    return "2025-11-15"

def add_article_schema(file_path):
    """Add Article schema to a blog post."""
    content = file_path.read_text(encoding='utf-8')

    # Check if Article schema already exists
    if '"@type": "Article"' in content or '"@type":"Article"' in content:
        print(f"  Skipping (already has Article schema): {file_path.name}")
        return False

    title = extract_title(content)
    url = extract_canonical_url(content)
    date = extract_date(content, file_path)

    # Escape quotes in title for JSON
    title = title.replace('"', '\\"')

    schema = get_article_schema(title, url, date)

    # Insert before </head>
    if '</head>' in content:
        new_content = content.replace('</head>', schema + '\n</head>')
        file_path.write_text(new_content, encoding='utf-8')
        print(f"  Added Article schema: {file_path.name}")
        return True
    else:
        print(f"  WARNING: No </head> found in {file_path.name}")
        return False

def main():
    total_added = 0

    for site in SITES:
        blog_dir = BASE_DIR / site / 'blog'
        print(f"\n=== Processing {site}/blog ===")

        if not blog_dir.exists():
            print(f"  Blog directory not found: {blog_dir}")
            continue

        for html_file in sorted(blog_dir.glob('*.html')):
            if add_article_schema(html_file):
                total_added += 1

    print(f"\n=== Summary ===")
    print(f"Article schemas added: {total_added}")

if __name__ == '__main__':
    main()
