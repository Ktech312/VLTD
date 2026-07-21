Set-Location "C:\Users\EK\VLTD"
$lock = ".git\index.lock"
if (Test-Path $lock) { Remove-Item $lock -Force }

git add "src/app/museum/new/page.tsx"
git add "src/app/museum/page.tsx"
git add "src/app/vault/item/[id]/page.tsx"
git add "src/components/ShareBar.tsx"
git add "src/components/SocialExportSheet.tsx"

git commit -m "feat: referral bonus galleries + bare share icons"
git push
Write-Host "Done."
