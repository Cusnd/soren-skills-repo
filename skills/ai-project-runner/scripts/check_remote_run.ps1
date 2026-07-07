[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SshTarget,

    [string]$RemoteProject = ".",

    [string]$TmuxSession,

    [ValidateRange(1, 500)]
    [int]$TailLines = 80
)

$ErrorActionPreference = "Stop"

function Invoke-ReadOnlySsh {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $sshArgs = @($SshTarget, $Command)
    & ssh @sshArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "ssh command exited with code $LASTEXITCODE"
    }
}

function Quote-RemoteSingle {
    param([string]$Value)
    return "'" + $Value.Replace("'", "'\''") + "'"
}

function Quote-RemotePath {
    param([string]$Value)

    if ($Value -eq "~") {
        return "~"
    }

    if ($Value.StartsWith("~/")) {
        $rest = $Value.Substring(2)
        if ([string]::IsNullOrEmpty($rest)) {
            return "~"
        }
        return "~/" + (Quote-RemoteSingle $rest)
    }

    return Quote-RemoteSingle $Value
}

$remoteProjectQuoted = Quote-RemotePath $RemoteProject

Write-Output "== tmux sessions =="
Invoke-ReadOnlySsh "tmux list-sessions 2>/dev/null || true"

if ($TmuxSession) {
    $sessionQuoted = Quote-RemoteSingle $TmuxSession
    Write-Output ""
    Write-Output "== tmux session detail =="
    Invoke-ReadOnlySsh "tmux list-windows -t $sessionQuoted 2>/dev/null || true"
}

Write-Output ""
Write-Output "== gpu status =="
Invoke-ReadOnlySsh "nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null || nvidia-smi 2>/dev/null || true"

Write-Output ""
Write-Output "== status files =="
Invoke-ReadOnlySsh "cd $remoteProjectQuoted 2>/dev/null && { if [ -f status.md ]; then printf '%s\n' '--- status.md ---'; sed -n '1,120p' status.md; fi; if [ -f state.json ]; then printf '%s\n' '--- state.json ---'; sed -n '1,160p' state.json; fi; } || true"

Write-Output ""
Write-Output "== latest log =="
Invoke-ReadOnlySsh "cd $remoteProjectQuoted 2>/dev/null && { if [ -e logs/latest.log ]; then tail -n $TailLines logs/latest.log; else printf '%s\n' 'logs/latest.log not found'; fi; } || true"
