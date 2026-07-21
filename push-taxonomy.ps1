# Run from PowerShell inside C:\Users\EK\VLTD\
Set-Location "C:\Users\EK\VLTD"

# Remove stale lock if present
$lock = ".git\index.lock"
if (Test-Path $lock) {
    Remove-Item $lock -Force
    Write-Host "Removed stale index.lock"
}

git add `
  src/lib/taxonomy.ts `
  src/lib/vaultModel.ts `
  src/lib/bulkAddState.ts `
  src/app/vault/add/page.tsx `
  src/app/learn/page.tsx `
  src/app/discover/page.tsx `
  "src/app/vault/[universe]/page.tsx" `
  src/app/vault/VaultCard.tsx `
  src/app/HomeClient.tsx `
  src/components/ItemVisibilityToggle.tsx `
  src/components/capture/captureFrames.ts `
  src/components/NavShell.tsx `
  src/components/PullToRefresh.tsx `
  src/app/globals.css

git commit -m @'
feat: vault UX cleanup — mass delete, scroll memory, eye icon, tap zones

vault/[universe]/page.tsx:
- Remove Readiness filter dropdown from toolbar
- Compact Graded Only into small checkbox toggle
- Remove Edit button from card hover (tap card text to navigate)
- Image area no longer navigates — only title/text section taps to edit
- Mass Delete: trash icon -> select mode, red checkboxes, Delete N + confirm
- Scroll position memory: saves/restores scrollY via sessionStorage

VaultCard.tsx (museum/gallery view):
- Outer <a> wrapper removed from image area
- Only text section (title/subtitle/value) is a link — photo tap no longer
  opens item, allowing horizontal swipe without accidental navigation

ItemVisibilityToggle.tsx:
- Private state: LockKeyhole icon -> EyeOff (crossed-out eye)
- Public state: Eye icon (unchanged)
- Communicates visibility, not lockedness

taxonomy.ts + vault/add/page.tsx:
- Art Cards restored to POP_CULTURE
- selectClass w-full fix (select overflow)
'@

git push

Write-Host "`nDone. Vercel will auto-deploy from the push."
