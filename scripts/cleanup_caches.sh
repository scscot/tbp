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
    "$HOME/Library/Developer/CoreSimulator/Devices"
do
    if [ -d "$cache_dir" ]; then
        echo "$(basename "$cache_dir"):"
        du -sh "$cache_dir"
    fi
done

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

# 3. Clear iOS Simulator data
echo "Clearing iOS Simulator devices..."
xcrun simctl delete unavailable
xcrun simctl erase all

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

echo
echo "✅ Cache cleanup completed!"
echo
echo "📝 To restore your project dependencies, run:"
echo "  flutter pub get"
echo "  cd ios && pod install && cd .."
echo
echo "💡 Tip: Your next build will take longer as caches are rebuilt,"
echo "   but subsequent builds will be fast again."

# Optional: Show space freed up
echo
echo "🎉 Cleanup summary - these directories are now empty or removed:"
for cache_dir in \
    "$HOME/Library/Developer/Xcode/DerivedData" \
    "$HOME/.pub-cache" \
    "$HOME/.gradle/caches" \
    "$HOME/Library/Caches/CocoaPods"
do
    if [ -d "$cache_dir" ]; then
        current_size=$(du -sh "$cache_dir" 2>/dev/null | cut -f1)
        echo "  $(basename "$cache_dir"): $current_size"
    else
        echo "  $(basename "$cache_dir"): removed"
    fi
done