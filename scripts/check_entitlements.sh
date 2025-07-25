#!/bin/bash

PROFILE_PATH="$HOME/Library/MobileDevice/Provisioning Profiles"
FOUND_MATCH=0

echo "🔍 Searching for provisioning profiles in:"
echo "$PROFILE_PATH"
echo ""

if [ ! -d "$PROFILE_PATH" ] || [ -z "$(ls -A "$PROFILE_PATH"/*.mobileprovision 2>/dev/null)" ]; then
  echo "❌ No provisioning profiles found. Open Xcode → Preferences → Accounts and refresh your team profiles."
  exit 1
fi

for file in "$PROFILE_PATH"/*.mobileprovision; do
  PROFILE_NAME=$(security cms -D -i "$file" 2>/dev/null | plutil -extract Name raw -)
  APP_ID=$(security cms -D -i "$file" 2>/dev/null | plutil -extract Entitlements.application-identifier raw -)

  if [[ "$APP_ID" == *"com.scott.ultimatefix"* ]]; then
    FOUND_MATCH=1
    echo "📄 Found profile: $PROFILE_NAME"
    echo "🆔 App Identifier: $APP_ID"

    TMP_PLIST=$(mktemp)
    security cms -D -i "$file" > "$TMP_PLIST"

    echo ""
    echo "🔑 Full Entitlements:"
    plutil -p "$TMP_PLIST" | grep -A 5 Entitlements

    echo ""
    echo "✅ Background Modes:"
    plutil -extract Entitlements.UIBackgroundModes xml1 -o - "$TMP_PLIST" 2>/dev/null || echo "❌ Not found"

    echo ""
    echo "✅ APS Environment (Push Notifications):"
    plutil -extract Entitlements.aps-environment xml1 -o - "$TMP_PLIST" 2>/dev/null || echo "❌ Not found"

    echo "—"
    rm "$TMP_PLIST"
  fi
done

if [ $FOUND_MATCH -eq 0 ]; then
  echo "❌ No provisioning profiles found for bundle ID: com.scott.ultimatefix"
  echo "💡 Tip: Rebuild or refresh in Xcode, or regenerate via developer.apple.com"
  exit 1
fi
