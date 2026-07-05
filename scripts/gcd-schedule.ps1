# GCD Weekly Sync — Windows Task Scheduler Setup
# ================================================
# Run this ONCE in PowerShell (as Administrator) to register a weekly
# scheduled task that keeps your GCD database up to date.
#
# Usage:
#   .\scripts\gcd-schedule.ps1           # install/update the task
#   .\scripts\gcd-schedule.ps1 -Remove   # uninstall the task
#   .\scripts\gcd-schedule.ps1 -RunNow   # trigger it immediately
#
# The task runs every Sunday at 2:00 AM.
# GCD publishes new dumps monthly, so a weekly check is plenty frequent —
# it only downloads (400-600 MB) when a newer dump is actually available.

param(
    [switch]$Remove,
    [switch]$RunNow
)

$TaskName    = "VLTD-GCD-Sync"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NodeCmd     = Get-Command node -ErrorAction SilentlyContinue
$NodePath    = if ($NodeCmd) { $NodeCmd.Source } else { $null }

if (-not $NodePath) {
    Write-Error "Node.js not found. Install it from https://nodejs.org and re-run."
    exit 1
}

$SyncScript  = Join-Path $ProjectRoot "scripts\gcd-sync.js"
$LogFile     = Join-Path $ProjectRoot "data\gcd-sync.log"
$EnvFile     = Join-Path $ProjectRoot ".env.local"

# ── Remove mode ────────────────────────────────────────────────
if ($Remove) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "✓ Task '$TaskName' removed." -ForegroundColor Green
    } else {
        Write-Host "Task '$TaskName' not found — nothing to remove."
    }
    exit 0
}

# ── Validate ────────────────────────────────────────────────────
if (-not (Test-Path $SyncScript)) {
    Write-Error "Sync script not found: $SyncScript"
    exit 1
}

if (-not (Test-Path $EnvFile)) {
    Write-Warning ".env.local not found at $ProjectRoot"
    Write-Warning "Create it with GCD_USERNAME and GCD_PASSWORD before the task runs."
}

# ── Build the action ────────────────────────────────────────────
# We call node with the sync script and pipe output to a log file.
# PowerShell -Command lets us redirect stdout+stderr cleanly.
$Command = @"
& '$NodePath' '$SyncScript' >> '$LogFile' 2>&1
"@

$Action = New-ScheduledTaskAction `
    -Execute    "powershell.exe" `
    -Argument   "-NoProfile -NonInteractive -Command `"$Command`"" `
    -WorkingDirectory $ProjectRoot

# ── Trigger: every Sunday at 02:00 ─────────────────────────────
$Trigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Sunday `
    -At "02:00"

# ── Settings ────────────────────────────────────────────────────
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -WakeToRun:$false

# ── Principal: run as current user ─────────────────────────────
$Principal = New-ScheduledTaskPrincipal `
    -UserId    ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType S4U `
    -RunLevel  Highest

# ── Register (or update) ────────────────────────────────────────
$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Existing) {
    Set-ScheduledTask `
        -TaskName   $TaskName `
        -Action     $Action `
        -Trigger    $Trigger `
        -Settings   $Settings `
        -Principal  $Principal | Out-Null
    Write-Host "✓ Task '$TaskName' updated." -ForegroundColor Green
} else {
    Register-ScheduledTask `
        -TaskName   $TaskName `
        -Action     $Action `
        -Trigger    $Trigger `
        -Settings   $Settings `
        -Principal  $Principal `
        -Description "Downloads and imports the latest GCD database dump for VLTD" | Out-Null
    Write-Host "✓ Task '$TaskName' registered." -ForegroundColor Green
}

Write-Host ""
Write-Host "Schedule:  Every Sunday at 2:00 AM" -ForegroundColor Cyan
Write-Host "Script:    $SyncScript"             -ForegroundColor Cyan
Write-Host "Log file:  $LogFile"                -ForegroundColor Cyan
Write-Host ""
Write-Host "To check GCD status right now:  node scripts/gcd-sync.js --check"
Write-Host "To force a re-download now:     node scripts/gcd-sync.js --force"

# ── RunNow mode ─────────────────────────────────────────────────
if ($RunNow) {
    Write-Host ""
    Write-Host "Running sync now (output goes to console and log)…" -ForegroundColor Yellow
    & $NodePath $SyncScript
}
