#!/bin/bash
#
# build-ios-release.sh
# Automated iOS Build, Archive, and Upload to App Store Connect
#
# Usage:
#   ./scripts/build-ios-release.sh           # Full build + upload
#   ./scripts/build-ios-release.sh --dry-run # Build only, no upload
#
# Prerequisites:
#   - Xcode installed and configured
#   - Flutter SDK installed
#   - App Store Connect API key at ~/private_keys/AuthKey_PKGJ47F6HZ.p8
#

set -e  # Exit on error

# Configuration
PROJECT_ROOT="/Users/sscott/tbp"
IOS_DIR="$PROJECT_ROOT/ios"
ARCHIVE_PATH="$IOS_DIR/build/Runner.xcarchive"
IPA_DIR="$IOS_DIR/build/ipa"
EXPORT_OPTIONS="$IOS_DIR/ExportOptions.plist"

# App Store Connect API credentials
API_KEY="PKGJ47F6HZ"
API_ISSUER="ca633e35-de51-47d8-85c1-6a1cbf7e951e"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
    esac
done

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  iOS Build, Archive & Upload Script${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Get version info from pubspec.yaml
VERSION=$(grep "^version:" "$PROJECT_ROOT/pubspec.yaml" | sed 's/version: //' | cut -d'+' -f1)
BUILD=$(grep "^version:" "$PROJECT_ROOT/pubspec.yaml" | sed 's/version: //' | cut -d'+' -f2)
echo -e "${YELLOW}Version:${NC} $VERSION (Build $BUILD)"
echo ""

# Step 1: Clean
echo -e "${BLUE}[1/6] Cleaning previous build...${NC}"
cd "$PROJECT_ROOT"
flutter clean > /dev/null 2>&1
echo -e "${GREEN}✓ Clean complete${NC}"

# Step 2: Get dependencies
echo -e "${BLUE}[2/6] Getting dependencies...${NC}"
flutter pub get > /dev/null 2>&1
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 3: Pod install
echo -e "${BLUE}[3/6] Installing CocoaPods...${NC}"
cd "$IOS_DIR"
pod install --silent > /dev/null 2>&1
echo -e "${GREEN}✓ Pods installed${NC}"

# Step 4: Build iOS release
echo -e "${BLUE}[4/6] Building iOS release...${NC}"
cd "$PROJECT_ROOT"
flutter build ios --release > /dev/null 2>&1
echo -e "${GREEN}✓ iOS build complete${NC}"

# Step 5: Archive
echo -e "${BLUE}[5/6] Creating archive...${NC}"
cd "$IOS_DIR"

# Remove old archive if exists
rm -rf "$ARCHIVE_PATH"
rm -rf "$IPA_DIR"

xcodebuild -workspace Runner.xcworkspace \
    -scheme Runner \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    archive \
    -quiet > /dev/null 2>&1

echo -e "${GREEN}✓ Archive created${NC}"

# Create ExportOptions.plist if it doesn't exist
if [ ! -f "$EXPORT_OPTIONS" ]; then
    cat > "$EXPORT_OPTIONS" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>YXV25WMDS8</string>
    <key>uploadSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
EOF
fi

# Export to IPA
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$IPA_DIR" \
    -exportOptionsPlist "$EXPORT_OPTIONS" \
    -quiet > /dev/null 2>&1

IPA_FILE="$IPA_DIR/Team Build Pro.ipa"
IPA_SIZE=$(du -h "$IPA_FILE" | cut -f1)
echo -e "${GREEN}✓ IPA exported ($IPA_SIZE)${NC}"

# Step 6: Upload to App Store Connect
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[6/6] Skipping upload (dry run)${NC}"
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  Build Complete (Dry Run)${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo -e "IPA: $IPA_FILE"
    echo -e "Size: $IPA_SIZE"
    echo -e "Version: $VERSION (Build $BUILD)"
else
    echo -e "${BLUE}[6/6] Uploading to App Store Connect...${NC}"

    # Check API key exists
    if [ ! -f ~/private_keys/AuthKey_${API_KEY}.p8 ]; then
        echo -e "${RED}✗ API key not found at ~/private_keys/AuthKey_${API_KEY}.p8${NC}"
        echo -e "${YELLOW}Copy from: $PROJECT_ROOT/secrets/AuthKey_${API_KEY}.p8${NC}"
        exit 1
    fi

    xcrun altool --upload-app --type ios \
        --file "$IPA_FILE" \
        --apiKey "$API_KEY" \
        --apiIssuer "$API_ISSUER" 2>&1 | tail -5

    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  Upload Complete!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo -e "Version: $VERSION (Build $BUILD)"
    echo -e "Size: $IPA_SIZE"
    echo -e ""
    echo -e "Next steps:"
    echo -e "  1. Wait 10-30 min for processing"
    echo -e "  2. Check App Store Connect for the build"
    echo -e "  3. Submit for review"
fi
