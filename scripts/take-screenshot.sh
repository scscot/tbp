#!/bin/bash

# Team Build Pro Screenshot Helper
# Usage: ./take-screenshot.sh [optional-filename]

SCREENSHOT_DIR="/Users/sscott/tbp/play-store-assets/screenshots/phone"
ADB_PATH="/Users/sscott/Library/Android/sdk/platform-tools/adb"

if [ "$1" ]; then
    FILENAME="$1.png"
else
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    FILENAME="screenshot-$TIMESTAMP.png"
fi

echo "Taking screenshot: $FILENAME"
$ADB_PATH exec-out screencap -p > "$SCREENSHOT_DIR/$FILENAME"
echo "Screenshot saved to: $SCREENSHOT_DIR/$FILENAME"
echo "Total screenshots in directory: $(ls -1 "$SCREENSHOT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')"