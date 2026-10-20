#!/bin/bash
# Installs the "Resize & Watermark" Finder Quick Action.
#   ./install.sh ~/Pictures/logo.png   # install, or change the watermark image
#   ./install.sh                       # reinstall, keeping the current watermark and settings
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
support="$HOME/Library/Application Support/ResizeWatermark"
services="$HOME/Library/Services"
workflow="Resize & Watermark.workflow"

mkdir -p "$support" "$services"
cp "$here/watermark.js" "$support/watermark.js"

if [ $# -ge 1 ]; then
  [ -f "$1" ] || { echo "No such file: $1" >&2; exit 1; }
  # Stored as PNG so transparency in the watermark is kept.
  sips -s format png "$1" --out "$support/watermark.png" >/dev/null
  echo "Watermark set to $1"
elif [ ! -f "$support/watermark.png" ]; then
  echo "Warning: no watermark yet. Run: ./install.sh /path/to/your-logo.png" >&2
fi

if [ ! -f "$support/config.json" ]; then
  cp "$here/config.json" "$support/config.json"
fi

rm -rf "$services/$workflow"
cp -R "$here/$workflow" "$services/$workflow"
xattr -dr com.apple.quarantine "$services/$workflow" "$support" 2>/dev/null || true
/System/Library/CoreServices/pbs -update 2>/dev/null || true

echo "Installed. Right-click images in Finder > Quick Actions > Resize & Watermark"
echo "Settings: $support/config.json"
