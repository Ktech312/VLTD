#!/bin/sh
# Clean slate, then the functional pass, then the landing-page touch measurement, on the live app.
export MSYS_NO_PATHCONV=1
SP="C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad"
WT="C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28"
export TUT_WORK="$SP/tut/ai/work"
OUT="$SP/final5"; mkdir -p "$OUT"
node "$WT/docs/walkthrough/add-item-guide/_build/clear-exhibitions.cjs" > "$OUT/prep.log" 2>&1
node "$WT/docs/walkthrough/tutorial-1-redo-v2/_build/reset-qa.cjs" >> "$OUT/prep.log" 2>&1
node "$SP/functional.cjs" "$OUT/functional" > "$OUT/functional.log" 2>&1
node "C:/Users/EK/VLTD/.claude/worktrees/bottom-bar/docs/mobile-correction-2026-10-28/touch-targets.cjs" "$OUT/touch.json" > "$OUT/touch.log" 2>&1
echo done > "$OUT/DONE"
