# 2.1 DerivedData (intermediate builds)
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 2.2 Old simulator runtimes/devices you no longer have installed
xcrun simctl delete unavailable

# (Optional) Erase all simulator contents (does not delete runtimes)
# xcrun simctl erase all

# 2.3 DeviceSupport (symbol files for old iOS versions). Keep current iOS.
ls -1 ~/Library/Developer/Xcode/iOS\ DeviceSupport
# Remove old versions explicitly, e.g.:
# rm -rf ~/Library/Developer/Xcode/iOS\ DeviceSupport/17.0\ */
