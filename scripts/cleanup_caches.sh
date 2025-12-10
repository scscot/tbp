#!/bin/bash

# Flutter Cache Cleanup Script
# Run these commands to free up significant disk space

echo "🧹 Starting Flutter/iOS cache cleanup..."
echo "This will clear build caches and downloaded dependencies."
echo "They will be re-downloaded when needed."
echo

# Show current disk usage before cleanup
echo "📊 Current disk usage of cache directories:"
echo

# Check Xcode DerivedData size
if [ -d "$HOME/Library/Developer/Xcode/DerivedData" ]; then
    echo "Xcode DerivedData:"
    du -sh "$HOME/Library/Developer/Xcode/DerivedData"
fi

# Check other cache sizes
for cache_dir in \
    "$HOME/.pub-cache" \
    "$HOME/.gradle/caches" \
    "$HOME/Library/Caches/CocoaPods" \
    "$HOME/.cocoapods" \
    "$HOME/.dartServer" \
    "$HOME/Library/Developer/CoreSimulator/Devices" \
    "$HOME/Library/Developer/Xcode/DocumentationCache" \
    "$HOME/Library/Developer/Xcode/Archives" \
    "$HOME/Library/Containers/com.apple.CoreDevice.CoreDeviceService/Data/Library/Caches" \
    "$HOME/Library/Caches/Homebrew"
do
    if [ -d "$cache_dir" ]; then
        echo "$(basename "$cache_dir"):"
        du -sh "$cache_dir"
    fi
done

# Check for leftover DMG files in /Applications
DMG_FILES=$(ls /Applications/*.dmg 2>/dev/null)
if [ -n "$DMG_FILES" ]; then
    echo "Leftover DMG files in /Applications:"
    du -sh /Applications/*.dmg 2>/dev/null
fi

echo
read -p "Continue with cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

echo
echo "🗑️  Clearing caches..."

# 1. Clear Xcode DerivedData (often 2-10GB+)
echo "Clearing Xcode DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 2. Clear Xcode device support files
echo "Clearing Xcode iOS DeviceSupport..."
rm -rf ~/Library/Developer/Xcode/iOS\ DeviceSupport/*

# 3. Clear iOS Simulator data (preserving specific simulators)
echo "Clearing iOS Simulator devices..."
xcrun simctl delete unavailable

# Preserved simulators (add UUIDs here to preserve them)
PRESERVE_DEVICES="679ABAB9-9899-414B-AB17-14422C7A10CD"

# Delete all simulators except preserved ones
echo "Deleting excess simulators..."
xcrun simctl list devices -j 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
preserve = ['$PRESERVE_DEVICES']
for runtime, devices in data.get('devices', {}).items():
    for device in devices:
        udid = device.get('udid', '')
        if udid and udid not in preserve:
            print(udid)
" 2>/dev/null | while read device_id; do
    xcrun simctl delete "$device_id" 2>/dev/null || true
done

echo "✓ Preserved: iPhone 16 Pro (18.5) - $PRESERVE_DEVICES"

# Erase preserved simulators to clear cached MobileAssets (Siri, TTS, etc.)
echo "Erasing preserved simulator to clear cached system assets..."
xcrun simctl erase "$PRESERVE_DEVICES" 2>/dev/null || true

# 4. Clear Flutter/Dart caches
echo "Clearing Flutter pub cache..."
rm -rf ~/.pub-cache

echo "Clearing Dart analysis server cache..."
rm -rf ~/.dartServer

# 5. Clear CocoaPods caches
echo "Clearing CocoaPods caches..."
rm -rf ~/Library/Caches/CocoaPods
pod cache clean --all 2>/dev/null || echo "CocoaPods not found, skipping pod cache clean"

echo "Clearing CocoaPods specs repo..."
rm -rf ~/.cocoapods

# 6. Clear Gradle caches (Android)
echo "Clearing Gradle caches..."
rm -rf ~/.gradle/caches

# 7. Clear Flutter project build artifacts
echo "Clearing Flutter project build artifacts..."
flutter clean

# 8. Clear iOS project build artifacts
if [ -f "ios/Podfile" ]; then
    echo "Clearing iOS Pods..."
    cd ios
    rm -rf Pods/
    rm -rf .symlinks/
    rm -rf Flutter/Flutter.framework
    rm -rf Flutter/App.framework
    cd ..
fi

# 9. Clear Android project build artifacts
echo "Clearing Android build artifacts..."
rm -rf android/.gradle
rm -rf android/app/build
rm -rf android/.cxx

# 10. Clear any node_modules in scripts directory
if [ -d "scripts/node_modules" ]; then
    echo "Clearing scripts/node_modules..."
    rm -rf scripts/node_modules
fi

# 11. Clear Xcode Documentation Cache (keep only latest version)
echo "Clearing old Xcode Documentation Cache versions..."
if [ -d "$HOME/Library/Developer/Xcode/DocumentationCache" ]; then
    # Keep only the latest version (highest number)
    LATEST_DOC=$(ls -1 "$HOME/Library/Developer/Xcode/DocumentationCache" 2>/dev/null | sort -V | tail -1)
    for doc_ver in "$HOME/Library/Developer/Xcode/DocumentationCache"/*; do
        if [ -d "$doc_ver" ] && [ "$(basename "$doc_ver")" != "$LATEST_DOC" ]; then
            echo "  Removing $(basename "$doc_ver")..."
            rm -rf "$doc_ver"
        fi
    done
    echo "✓ Kept: $LATEST_DOC"
fi

# 12. Clear CoreDeviceService Cache (Xcode device connection cache)
echo "Clearing CoreDeviceService cache..."
rm -rf "$HOME/Library/Containers/com.apple.CoreDevice.CoreDeviceService/Data/Library/Caches"/*

# 13. Clear Xcode Archives (optional - comment out if you want to keep archives)
echo "Clearing Xcode Archives..."
rm -rf "$HOME/Library/Developer/Xcode/Archives"/*

# 14. Clear Homebrew cache
echo "Clearing Homebrew cache..."
brew cleanup --prune=all 2>/dev/null || echo "Homebrew not found, skipping"

# 15. Delete leftover DMG files in /Applications
echo "Checking for leftover DMG files in /Applications..."
for dmg in /Applications/*.dmg; do
    if [ -f "$dmg" ]; then
        echo "  Removing: $dmg"
        rm -f "$dmg"
    fi
done

echo
echo "✅ Cache cleanup completed!"
echo

# 16. Restore Flutter project dependencies
echo "📝 Restoring project dependencies..."
cd /Users/sscott/tbp
flutter clean
flutter pub get
cd ios/
pod install
cd ..

echo
echo "💡 Tip: Your next build will take longer as caches are rebuilt,"
echo "   but subsequent builds will be fast again."

# Optional: Show space freed up
echo
echo "🎉 Cleanup summary - these directories are now empty or reduced:"
for cache_dir in \
    "$HOME/Library/Developer/Xcode/DerivedData" \
    "$HOME/.pub-cache" \
    "$HOME/.gradle/caches" \
    "$HOME/Library/Caches/CocoaPods" \
    "$HOME/Library/Developer/Xcode/DocumentationCache" \
    "$HOME/Library/Developer/Xcode/Archives" \
    "$HOME/Library/Containers/com.apple.CoreDevice.CoreDeviceService/Data/Library/Caches" \
    "$HOME/Library/Caches/Homebrew"
do
    if [ -d "$cache_dir" ]; then
        current_size=$(du -sh "$cache_dir" 2>/dev/null | cut -f1)
        echo "  $(basename "$cache_dir"): $current_size"
    else
        echo "  $(basename "$cache_dir"): removed"
    fi
done

# Show final disk space
echo
echo "📊 Current disk space:"
df -h / | tail -1 | awk '{print "  Available: " $4 " of " $2}'