#!/usr/bin/env python3
"""
Comprehensive footer audit for all HTML pages.
Checks that all footers match the expected structure.
"""

import os
import re
import glob

BASE_PATH = "/Users/sscott/tbp"

# Expected footer structure (should contain footer-logo, footer-links, currentYear)
REQUIRED_ELEMENTS = [
    r'<footer class="footer">',
    r'<div class="footer-logo">',
    r'<div class="footer-links">',
    r'<span id="currentYear">',
]

# Footer links that should exist in footer-links div
FOOTER_LINKS = {
    "en": ["Pricing", "FAQ", "Books", "Recruiting Guides", "Contact", "Privacy Policy", "Terms of Service"],
    "es": ["Precios", "Preguntas Frecuentes", "Libros", "Guías de Reclutamiento", "Contacto", "Política de Privacidad", "Términos de Servicio"],
    "pt": ["Preços", "Perguntas Frequentes", "Livros", "Guias de Recrutamento", "Contato", "Política de Privacidade", "Termos de Serviço"],
    "de": ["Preise", "Häufige Fragen", "Bücher", "Recruiting-Leitfäden", "Kontakt", "Datenschutzrichtlinie", "Nutzungsbedingungen"],
}

def audit_footer(file_path, lang):
    """Audit a single file's footer."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    issues = []

    # Check for required elements
    for element in REQUIRED_ELEMENTS:
        if not re.search(element, content):
            issues.append(f"Missing: {element}")

    # Check for footer-links content
    footer_match = re.search(r'<div class="footer-links">(.*?)</div>', content, re.DOTALL)
    if footer_match:
        footer_links_content = footer_match.group(1)
        for link_text in FOOTER_LINKS.get(lang, []):
            if link_text not in footer_links_content:
                issues.append(f"Missing link: {link_text}")
    else:
        issues.append("footer-links div not found or malformed")

    # Check for author credit (should NOT exist)
    if "stephenscott.us" in content and 'rel="author"' in content:
        issues.append("Author credit still present")

    return issues


def main():
    directories = {
        "web": "en",
        "web-es": "es",
        "web-pt": "pt",
        "web-de": "de"
    }

    all_issues = {}
    total_files = 0
    files_with_issues = 0

    for dir_name, lang in directories.items():
        dir_path = os.path.join(BASE_PATH, dir_name)
        if not os.path.exists(dir_path):
            print(f"Directory not found: {dir_path}")
            continue

        # Check main pages and blog
        patterns = [
            os.path.join(dir_path, "*.html"),
            os.path.join(dir_path, "blog", "*.html"),
        ]

        for pattern in patterns:
            html_files = glob.glob(pattern)
            for html_file in html_files:
                # Skip some pages that may have different footers
                basename = os.path.basename(html_file)
                if basename in ["delete-account.html", "claim.html", "claim-google.html", "firestore-monitor.html"]:
                    continue

                total_files += 1
                issues = audit_footer(html_file, lang)

                if issues:
                    files_with_issues += 1
                    rel_path = os.path.relpath(html_file, BASE_PATH)
                    all_issues[rel_path] = issues
                    print(f"❌ {rel_path}")
                    for issue in issues:
                        print(f"   - {issue}")

    print(f"\n{'='*60}")
    print(f"Total files audited: {total_files}")
    print(f"Files with issues: {files_with_issues}")
    print(f"Files OK: {total_files - files_with_issues}")

    if files_with_issues == 0:
        print("\n✅ All footers are correctly structured!")
    else:
        print(f"\n⚠️  {files_with_issues} files need attention")


if __name__ == "__main__":
    main()
