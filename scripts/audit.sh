#!/bin/bash

# Audit common Flutter/iOS/Android caches & build products
# This function checks a predefined list of common cache and data directories
# used by Xcode, Android Studio, CocoaPods, and Flutter/Dart. It then reports
# the disk usage for each directory found, sorted by size.
audit_flutter_space() {
  local p=(
    "$HOME/Library/Developer/Xcode/DerivedData"
    "$HOME/Library/Developer/CoreSimulator/Devices"
    "$HOME/Library/Developer/Xcode/iOS DeviceSupport"
    "$HOME/Library/Caches/CocoaPods"
    "$HOME/.cocoapods"
    "$HOME/.pub-cache"
    "$HOME/.dartServer"
    "$HOME/.gradle/caches"
    "$HOME/Library/Android/sdk"
    "$HOME/Library/Android/avd"
    "$HOME/development/flutter/bin/cache"
  )
  # Loop through the array of paths
  # For each path, check if it's a directory (-d)
  # If it is, run `du -sh` (disk usage, summarized, human-readable) on it
  # Redirect errors (2>/dev/null) to hide "No such file or directory" messages
  # Pipe the output to `sort -h` to sort by human-readable size (e.g., K, M, G)
  for d in "${p[@]}"; do [[ -d "$d" ]] && du -sh "$d" 2>/dev/null; done | sort -h
}

# Audit per-project build artifacts; pass your project path (defaults to PWD)
# This function scans a specific project directory for common build artifact folders
# like 'build', '.dart_tool', and 'Pods', and reports their disk usage.
project_flutter_space() {
  # Set the root directory to the first argument passed, or default to the current working directory ($PWD)
  local root="${1:-$PWD}"
  echo "Scanning: $root"
  # Find directories (-type d) with specific names (-name)
  # The -prune option prevents find from descending into the found directories
  # -exec runs `du -sh` on the found directories
  # Redirect errors and sort the final output by size
  find "$root" -type d \( -name build -o -name .dart_tool -o -name Pods \) -prune -exec du -sh {} + 2>/dev/null | sort -h
}

# --- Usage Example ---
# To run the script, you would typically save it to a file (e.g., audit.sh),
# make it executable (`chmod +x audit.sh`), and then run it.
# The lines below demonstrate how the functions are called.

echo "--- Auditing Global Caches ---"
audit_flutter_space

echo ""
echo "--- Auditing Project Artifacts in ~/tbp ---"
project_flutter_space ~/tbp
