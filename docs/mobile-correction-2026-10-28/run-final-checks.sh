#!/bin/sh
# Runs the three phone checks one after another against the live app, as one synthetic collector (manifest passed in AUDIT_MANIFEST).
#   AUDIT_MANIFEST=<qa manifest> sh run-final-checks.sh <outDir>
export MSYS_NO_PATHCONV=1
HERE="$(cd "$(dirname "$0")" && pwd -W)"
OUT="$1"
export TUT_WORK="${TUT_WORK:-$OUT/work}"
mkdir -p "$OUT"
node "$HERE/audit-phone.cjs" "$OUT/screens" > "$OUT/screens.log" 2>&1
node "$HERE/touch-targets.cjs" "$OUT/touch.json" > "$OUT/touch.log" 2>&1
node "$HERE/install-prompt-check.cjs" "$OUT/install-prompt" > "$OUT/install-prompt.log" 2>&1
echo done > "$OUT/DONE"
