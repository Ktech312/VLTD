param(
    [double]$MinMB = 25,
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$codexHome = Join-Path $env:USERPROFILE ".codex"
$sessionsRoot = Join-Path $codexHome "sessions"
$sessionIndex = Join-Path $codexHome "session_index.jsonl"
$stateDb = Join-Path $codexHome "state_5.sqlite"
$python = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if (-not (Test-Path $sessionsRoot)) {
    throw "Sessions folder not found: $sessionsRoot"
}

$largeSessions = Get-ChildItem -Path $sessionsRoot -Recurse -File -Filter *.jsonl |
    Where-Object { $_.Length -ge ($MinMB * 1MB) } |
    Sort-Object Length -Descending

if (-not $largeSessions) {
    Write-Host "No session files larger than $MinMB MB were found."
    exit 0
}

$targets = foreach ($file in $largeSessions) {
    if ($file.Name -match "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})") {
        [pscustomobject]@{
            Id = $Matches[1]
            Path = $file.FullName
            MB = [math]::Round($file.Length / 1MB, 2)
        }
    }
}

Write-Host "Oversized Codex threads:"
$targets | Format-Table Id, MB, Path -AutoSize

if (-not $Apply) {
    Write-Host ""
    Write-Host "Dry run only. Re-run with -Apply after closing Codex Desktop to quarantine these threads."
    exit 0
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$quarantineRoot = Join-Path $codexHome "quarantine\large-thread-freeze-$stamp"
$quarantineSessions = Join-Path $quarantineRoot "sessions"
$quarantineBackups = Join-Path $quarantineRoot "backups"
New-Item -ItemType Directory -Path $quarantineSessions,$quarantineBackups -Force | Out-Null

Copy-Item -LiteralPath $sessionIndex -Destination (Join-Path $quarantineBackups "session_index.jsonl")
foreach ($dbFile in @("state_5.sqlite", "state_5.sqlite-wal", "state_5.sqlite-shm")) {
    $source = Join-Path $codexHome $dbFile
    if (Test-Path $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $quarantineBackups $dbFile)
    }
}

$ids = @($targets | ForEach-Object { $_.Id })
$idsJson = ConvertTo-Json -Compress $ids

$tmpIndex = "$sessionIndex.tmp-quarantine"
Get-Content -LiteralPath $sessionIndex | Where-Object {
    $line = $_
    -not ($ids | Where-Object { $line -match [regex]::Escape($_) })
} | Set-Content -LiteralPath $tmpIndex -Encoding utf8
Move-Item -LiteralPath $tmpIndex -Destination $sessionIndex -Force

$env:CODEX_QUARANTINE_IDS = $idsJson
$env:CODEX_STATE_DB = $stateDb
& $python -c @"
import json, os, sqlite3
ids = json.loads(os.environ["CODEX_QUARANTINE_IDS"])
db = os.environ["CODEX_STATE_DB"]
con = sqlite3.connect(db)
try:
    con.executemany("delete from thread_dynamic_tools where thread_id=?", [(i,) for i in ids])
    con.executemany("delete from thread_goals where thread_id=?", [(i,) for i in ids])
    con.executemany("delete from threads where id=?", [(i,) for i in ids])
    con.commit()
finally:
    con.close()
"@

foreach ($target in $targets) {
    $dest = Join-Path $quarantineSessions (Split-Path -Leaf $target.Path)
    Move-Item -LiteralPath $target.Path -Destination $dest -Force
}

$restoreScript = Join-Path $quarantineRoot "restore.ps1"
@"
`$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "$quarantineBackups\session_index.jsonl" -Destination "$sessionIndex" -Force
Copy-Item -LiteralPath "$quarantineBackups\state_5.sqlite" -Destination "$stateDb" -Force
if (Test-Path "$quarantineBackups\state_5.sqlite-wal") { Copy-Item -LiteralPath "$quarantineBackups\state_5.sqlite-wal" -Destination "$(Join-Path $codexHome "state_5.sqlite-wal")" -Force }
if (Test-Path "$quarantineBackups\state_5.sqlite-shm") { Copy-Item -LiteralPath "$quarantineBackups\state_5.sqlite-shm" -Destination "$(Join-Path $codexHome "state_5.sqlite-shm")" -Force }
Get-ChildItem -LiteralPath "$quarantineSessions" -File | ForEach-Object {
    if (`$_.Name -match "rollout-(\d{4})-(\d{2})-(\d{2})T") {
        `$destDir = Join-Path "$sessionsRoot" ("{0}\{1}\{2}" -f `$Matches[1], `$Matches[2], `$Matches[3])
        New-Item -ItemType Directory -Path `$destDir -Force | Out-Null
        Move-Item -LiteralPath `$_.FullName -Destination (Join-Path `$destDir `$_.Name) -Force
    }
}
Write-Host "Restored quarantined Codex threads."
"@ | Set-Content -LiteralPath $restoreScript -Encoding utf8

Write-Host ""
Write-Host "Quarantined $($targets.Count) oversized thread(s)."
Write-Host "Backup and restore script: $quarantineRoot"
