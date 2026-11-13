#!/bin/bash
# Regenerate every committed app/tray icon from the Revio SVG sources in this folder.
# Needs macOS (qlmanage, iconutil) and the repo's node_modules (pngjs).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/generate.mjs"
echo "Done! Icons generated in resources/build/, resources/app-icons/ and resources/tray/"
