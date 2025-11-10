#!/usr/bin/env python3
import json

# Read untranslated keys
with open('/tmp/untranslated_keys.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse key-value pairs
untranslated = {}
for line in lines:
    if '|||' in line:
        parts = line.strip().split('|||', 1)
        if len(parts) == 2:
            untranslated[parts[0]] = parts[1]

print(f"Found {len(untranslated)} untranslated keys")

# Create output file with all keys in Python dict format for easy translation
with open('/tmp/keys_to_translate.txt', 'w', encoding='utf-8') as f:
    for key, value in sorted(untranslated.items()):
        # Escape quotes and backslashes for Python string
        escaped_value = value.replace('\\', '\\\\').replace('"', '\\"')
        f.write(f'"{key}": "{escaped_value}",\n')

print(f"Written keys to /tmp/keys_to_translate.txt")
print(f"First 10 keys:")
for i, (key, value) in enumerate(sorted(untranslated.items())[:10]):
    print(f"  {key}: {value}")
