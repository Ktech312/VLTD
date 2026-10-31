#!/bin/sh
# Coverage run: populated account, then the same account emptied (items and exhibitions removed), against the live app.
#   AUDIT_MANIFEST=<manifest> sh run-coverage.sh <outDir>
export MSYS_NO_PATHCONV=1
OUT="$1"
SP="C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad"
WT="C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28"
export TUT_WORK="$SP/tut/ai/work"
mkdir -p "$OUT"
STATE=populated node "$SP/audit-pages.cjs" "$OUT" > "$OUT/populated.log" 2>&1
node "$WT/docs/walkthrough/add-item-guide/_build/clear-exhibitions.cjs" > "$OUT/empty-prep.log" 2>&1
node "$WT/docs/walkthrough/tutorial-1-redo-v2/_build/reset-qa.cjs" >> "$OUT/empty-prep.log" 2>&1
STATE=empty node "$SP/audit-pages.cjs" "$OUT" > "$OUT/empty.log" 2>&1
echo done > "$OUT/DONE"
