#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/presentation-study.pdf"
HTML="file://${ROOT}/presentation-study.html"

for CHROME in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
  if [[ -x "$CHROME" ]]; then
    exec "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
      --print-to-pdf="$OUT" "$HTML"
  fi
done

echo "Chrome/Chromium not found. Open presentation-study.html in a browser → Print → Save as PDF." >&2
exit 1
