#!/bin/bash

# Translation script for blog posts
# This script uses Claude to translate blog posts from English to Spanish and Portuguese

echo "Blog Translation Status:"
echo "======================="
echo ""
echo "Spanish (ES) - Completed:"
grep -l 'lang="es"' /Users/sscott/tbp/web-es/blog/*.html 2>/dev/null | xargs -n1 basename
echo ""
echo "Spanish (ES) - Remaining:"
for file in /Users/sscott/tbp/web-es/blog/*.html; do
  if ! grep -q 'lang="es"' "$file" 2>/dev/null; then
    basename "$file"
  fi
done
echo ""
echo "Portuguese (PT) - Completed:"
grep -l 'lang="pt"' /Users/sscott/tbp/web-pt/blog/*.html 2>/dev/null | xargs -n1 basename
echo ""
echo "Portuguese (PT) - Remaining:"
for file in /Users/sscott/tbp/web-pt/blog/*.html; do
  if ! grep -q 'lang="pt"' "$file" 2>/dev/null; then
    basename "$file"
  fi
done
