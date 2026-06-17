$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -LiteralPath $root

$launcherPidPath = Join-Path $root 'launcher_background.pid'
$cmdPidPath = Join-Path $root 'cmd_background.pid'
$stopFlagPath = Join-Path $root 'launcher_background.stop'

$watchIntervalMs = 500
$maxStopWaitSec = 8

function Write-Pid([string]$path, [int]$id) {
    try { $id | Out-File -FilePath $path -Encoding ascii -Force -ErrorAction Stop } catch {}
}
function Remove-FileSafe([string]$path) {
    try { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue } catch {}
}
function Get-ProcessSafe([int]$id) {
    try { return Get-Process -Id $id -ErrorAction Stop } catch { return $null }
}
function Stop-ProcessSafe([int]$id) {
    $p = Get-ProcessSafe -id $id
    if (-not $p) { return $true }
    try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } catch {}

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $maxStopWaitSec) {
        if (-not (Get-ProcessSafe -id $id)) { return $true }
        Start-Sleep -Milliseconds 200
    }
    return (-not (Get-ProcessSafe -id $id))
}

function Start-CmdNode {
    param([string]$workDir, [string]$nodeArgs = "index.js")
    try {
        $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c node $nodeArgs" -WorkingDirectory $workDir -PassThru -WindowStyle Hidden -ErrorAction Stop
        Write-Pid -path $cmdPidPath -id $proc.Id
        return $proc
    } catch {
        return $null
    }
}

Write-Pid -path $launcherPidPath -id $PID

$existingPid = $null
if (Test-Path -LiteralPath $cmdPidPath) {
    try { $existingPid = [int](Get-Content -LiteralPath $cmdPidPath -ErrorAction SilentlyContinue) } catch { $existingPid = $null }
}

$cmdProc = $null
if ($existingPid -and (Get-ProcessSafe -id $existingPid)) {
    try { $cmdProc = Get-Process -Id $existingPid -ErrorAction Stop } catch { $cmdProc = $null }
}

if (-not $cmdProc) {
    $cmdProc = Start-CmdNode -workDir $root
}

while ($true) {
    try {
        if (Test-Path -LiteralPath $stopFlagPath) {
            Remove-FileSafe $stopFlagPath
            if ($cmdProc) { Stop-ProcessSafe -id $cmdProc.Id | Out-Null }
            Remove-FileSafe $cmdPidPath
            Remove-FileSafe $launcherPidPath
            exit 0
        }

        if (-not $cmdProc -or -not (Get-ProcessSafe -id $cmdProc.Id)) {
            Remove-FileSafe $cmdPidPath
            $cmdProc = Start-CmdNode -workDir $root
        }
    } catch {}

    Start-Sleep -Milliseconds $watchIntervalMs
}
