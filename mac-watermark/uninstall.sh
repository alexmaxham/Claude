#!/bin/bash
# Removes the Quick Action and its settings.
set -euo pipefail
rm -rf "$HOME/Library/Services/Resize & Watermark.workflow"
rm -rf "$HOME/Library/Application Support/ResizeWatermark"
/System/Library/CoreServices/pbs -update 2>/dev/null || true
echo "Removed Resize & Watermark."
