#!/usr/bin/env python3
import os
import re

blog_dirs = [
    '/Users/sscott/tbp/web-es/blog',
    '/Users/sscott/tbp/web-pt/blog'
]

files_to_update = [
    'ai-automation-transforms-direct-sales.html',
    'ai-recruiting-best-practices-2025.html',
    'qualify-new-recruits-30-days.html',
    'team-build-pro-november-2025-update.html',
    'young-living-recruiting-strategies.html'
]

for blog_dir in blog_dirs:
    for filename in files_to_update:
        filepath = os.path.join(blog_dir, filename)

        if not os.path.exists(filepath):
            print(f"Skipping {filepath} (not found)")
            continue

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # 1. Add .store-badge CSS if missing
        if '.store-badge{' not in content:
            # Find the .download-buttons CSS and add .store-badge CSS after it
            content = re.sub(
                r'(\.download-buttons\{[^}]+\})',
                r'\1\n    .store-badge{display:inline-flex;align-items:center;justify-content:center;transition:transform 0.2s}\n    .store-badge:hover{transform:translateY(-2px)}\n    .store-badge img{height:60px;width:auto;display:block}',
                content
            )

        # 2. Replace Google-Play.png with GooglePlay.png
        content = content.replace('/assets/images/Google-Play.png', '/assets/images/GooglePlay.png')

        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")
        else:
            print(f"No changes needed for {filepath}")

print("\nDone!")
