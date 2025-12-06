#!/bin/bash
#
# create-project-zip.sh
# Creates a compressed zip of Team Build Pro websites and app code
# Excludes: node_modules, build artifacts, secrets, leads, cache files
#

OUTPUT_FILE="$HOME/Desktop/TeamBuildPro-WebsitesAndApp.zip"
PROJECT_DIR="/Users/sscott/tbp"

echo "📦 Creating Team Build Pro archive..."
echo "   Output: $OUTPUT_FILE"

# Remove existing zip if present
if [ -f "$OUTPUT_FILE" ]; then
    echo "   Removing existing archive..."
    rm "$OUTPUT_FILE"
fi

cd "$PROJECT_DIR"

zip -r "$OUTPUT_FILE" \
  web/ \
  web-es/ \
  web-pt/ \
  web-de/ \
  sscott/ \
  lib/ \
  assets/ \
  functions/*.js \
  functions/*.json \
  functions/email_templates/ \
  functions/locales/ \
  functions/lib/ \
  functions/src/ \
  functions/shared/ \
  pubspec.yaml \
  firebase.json \
  firestore.rules \
  firestore.indexes.json \
  .firebaserc \
  -x "*.DS_Store" \
  -x "*/__pycache__/*" \
  -x "*/node_modules/*" \
  -x "*.pyc" \
  -x "*/venv/*" \
  -x "*/.git/*"

echo ""
echo "✅ Archive created successfully!"
ls -lh "$OUTPUT_FILE"
echo ""
echo "Contents:"
echo "  - 5 websites (EN, ES, PT, DE, Author)"
echo "  - Flutter app code (lib/, assets/)"
echo "  - Cloud Functions source"
echo "  - Firebase configuration"
