#!/bin/bash
#
# Convert videos to App Store preview format
# Requirements: ffmpeg (install via: brew install ffmpeg)
#
# Usage: Place videos in ~/Downloads/app_preview_input/ then run this script
#

set -e

# Configuration
INPUT_DIR="$HOME/Downloads/app_preview_input"
OUTPUT_DIR="$HOME/tbp/assets/videos"

echo "=== App Store Video Preview Converter ==="
echo "Input:  $INPUT_DIR"
echo "Output: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "ERROR: ffmpeg is not installed."
    echo "Install it with: brew install ffmpeg"
    exit 1
fi

# Process each video in the input directory
VIDEO_COUNT=0
shopt -s nullglob
for video in "$INPUT_DIR"/*.mov "$INPUT_DIR"/*.MOV "$INPUT_DIR"/*.mp4 "$INPUT_DIR"/*.MP4 "$INPUT_DIR"/*.m4v "$INPUT_DIR"/*.M4V; do

    BASENAME=$(basename "$video")
    FILENAME="${BASENAME%.*}"
    OUTPUT_FILE="$OUTPUT_DIR/${FILENAME}_appstore.mp4"

    echo "Processing: $BASENAME"
    echo "  -> $OUTPUT_FILE"

    # Convert to 886x1920, crop to fit, add silent audio track
    # App Store 6.7" iPhone preview: 886x1920 (portrait)
    # Note: App Store requires an audio track (even if silent) or it shows "corrupted audio" error
    ffmpeg -y -i "$video" \
        -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
        -vf "scale=886:1920:force_original_aspect_ratio=increase,crop=886:1920" \
        -c:v libx264 \
        -profile:v baseline \
        -level 3.0 \
        -pix_fmt yuv420p \
        -c:a aac \
        -b:a 128k \
        -r 30 \
        -shortest \
        "$OUTPUT_FILE"

    VIDEO_COUNT=$((VIDEO_COUNT + 1))
    echo "  Done!"
    echo ""
done

echo "=== Summary ==="
echo "Videos converted: $VIDEO_COUNT"
echo "Output directory: $OUTPUT_DIR"
echo ""

if [ $VIDEO_COUNT -eq 0 ]; then
    echo "No videos found to convert."
    echo "Place video files in: $INPUT_DIR"
fi

# List output files
if [ $VIDEO_COUNT -gt 0 ]; then
    echo "Output files:"
    ls -la "$OUTPUT_DIR"/*_appstore.mp4 2>/dev/null || true
fi
