#!/bin/bash

if [ -f ".ralph-complete" ]; then
  echo "✅ Build complete. Stopping Ralph."
  exit 0
fi

if [ -f "js/pin.js" ] && [ -f "js/sync.js" ] && [ -f "api/recovery.js" ]; then
  if node --check js/pin.js 2>/dev/null && node --check js/sync.js 2>/dev/null; then
    echo "✅ All files present and valid. Stopping Ralph."
    touch .ralph-complete
    exit 0
  fi
fi

exit 1
