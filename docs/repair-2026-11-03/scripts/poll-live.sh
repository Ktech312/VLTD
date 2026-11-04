#!/bin/bash
# polls the live site until the exhibition Share panel no longer shows the profile-private warning
export MSYS_NO_PATHCONV=1
for i in $(seq 1 14); do
  r=$(node sharetext.cjs /museum/3c3bdc4f-e9cd-41c4-a0dc-9c73b542c83c "Share this exhibition" live-after-fix-exhibition-share --base=https://vltd.app 2>&1 | grep "warning element present")
  echo "try $i: $r"
  echo "$r" | grep -q "false" && { echo DEPLOYED; exit 0; }
  sleep 45
done
echo TIMEOUT
