param(
    [int]$MaxTitleChars = 240,
    [int]$MaxPreviewChars = 360,
    [switch]$PruneVerboseLogs,
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$codexHome = Join-Path $env:USERPROFILE ".codex"
$stateDb = Join-Path $codexHome "state_5.sqlite"
$logsDb = Join-Path $codexHome "logs_2.sqlite"
$python = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if (-not (Test-Path $stateDb)) {
    throw "Codex state database not found: $stateDb"
}

if (-not (Test-Path $python)) {
    throw "Bundled Python not found: $python"
}

if ($Apply) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupRoot = Join-Path $codexHome "quarantine\blank-chat-repair-$stamp"
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    foreach ($file in @(
        "state_5.sqlite",
        "state_5.sqlite-wal",
        "state_5.sqlite-shm",
        "logs_2.sqlite",
        "logs_2.sqlite-wal",
        "logs_2.sqlite-shm",
        "session_index.jsonl"
    )) {
        $source = Join-Path $codexHome $file
        if (Test-Path $source) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $backupRoot $file) -Force
        }
    }

    @"
`$ErrorActionPreference = "Stop"
`$codexHome = Join-Path `$env:USERPROFILE ".codex"
foreach (`$file in @(
    "state_5.sqlite",
    "state_5.sqlite-wal",
    "state_5.sqlite-shm",
    "logs_2.sqlite",
    "logs_2.sqlite-wal",
    "logs_2.sqlite-shm",
    "session_index.jsonl"
)) {
    `$source = Join-Path "$backupRoot" `$file
    if (Test-Path `$source) {
        Copy-Item -LiteralPath `$source -Destination (Join-Path `$codexHome `$file) -Force
    }
}
Write-Host "Restored Codex backup from $backupRoot"
"@ | Set-Content -LiteralPath (Join-Path $backupRoot "restore.ps1") -Encoding utf8

    Write-Host "Backup created: $backupRoot"
}

$env:CODEX_STATE_DB = $stateDb
$env:CODEX_LOGS_DB = $logsDb
$env:CODEX_MAX_TITLE_CHARS = [string]$MaxTitleChars
$env:CODEX_MAX_PREVIEW_CHARS = [string]$MaxPreviewChars
$env:CODEX_PRUNE_VERBOSE_LOGS = if ($PruneVerboseLogs) { "1" } else { "0" }
$env:CODEX_APPLY_REPAIR = if ($Apply) { "1" } else { "0" }
$env:PYTHONIOENCODING = "utf-8"

@'
import os, sqlite3

state = os.environ["CODEX_STATE_DB"]
logs = os.environ["CODEX_LOGS_DB"]
max_title = int(os.environ["CODEX_MAX_TITLE_CHARS"])
max_preview = int(os.environ["CODEX_MAX_PREVIEW_CHARS"])
prune_logs = os.environ["CODEX_PRUNE_VERBOSE_LOGS"] == "1"
apply = os.environ["CODEX_APPLY_REPAIR"] == "1"

def compact_text(value):
    return " ".join(str(value or "").replace("\r", " ").replace("\n", " ").split())

def repaired_card(title, preview, first_user_message):
    new_title = title or ""
    new_preview = preview or ""
    if len(new_title) > max_title or new_title.startswith("The following is the Codex agent history"):
        source = compact_text(first_user_message or new_title)
        if source.startswith("The following is the Codex agent history"):
            source = "Large approval review transcript"
        new_title = source[:140] or "Recovered Codex thread"
    if len(new_preview) > max_preview or new_preview.startswith("The following is the Codex agent history"):
        source = compact_text(first_user_message or new_preview or new_title)
        if source.startswith("The following is the Codex agent history"):
            source = new_title
        new_preview = source[:220] or new_title
    return new_title, new_preview

con = sqlite3.connect(state, timeout=30)
try:
    con.execute("pragma busy_timeout=30000")
    rows = con.execute(
        "select id,title,preview,first_user_message,tokens_used from threads"
    ).fetchall()
    repairs = []
    for thread_id, title, preview, first_user_message, tokens_used in rows:
        new_title, new_preview = repaired_card(title, preview, first_user_message)
        if new_title != (title or "") or new_preview != (preview or ""):
            repairs.append((thread_id, tokens_used, len(title or ""), len(preview or ""), new_title))
            if apply:
                con.execute(
                    "update threads set title=?, preview=? where id=?",
                    (new_title, new_preview, thread_id),
                )
    if apply:
        con.commit()
    print(f"thread_cards_to_repair={len(repairs)}")
    for thread_id, tokens_used, title_len, preview_len, new_title in repairs[:25]:
        print(f"{thread_id} tokens={tokens_used} title_len={title_len} preview_len={preview_len} -> {new_title}")
finally:
    con.close()

if prune_logs and os.path.exists(logs):
    con = sqlite3.connect(logs, timeout=30)
    try:
        con.execute("pragma busy_timeout=30000")
        before = con.execute("select count(*) from logs").fetchone()[0]
        if apply:
            con.execute("delete from logs where level in ('TRACE','DEBUG')")
            con.commit()
            con.execute("pragma wal_checkpoint(truncate)")
            con.execute("vacuum")
        after = con.execute("select count(*) from logs").fetchone()[0]
        print(f"logs_before={before} logs_after={after} verbose_rows={'deleted' if apply else 'would_delete'}")
    finally:
        con.close()
'@ | & $python -

if (-not $Apply) {
    Write-Host ""
    Write-Host "Dry run only. Re-run with -Apply to repair oversized chat cards."
}
