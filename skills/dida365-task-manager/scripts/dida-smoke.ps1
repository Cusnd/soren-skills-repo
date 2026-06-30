[CmdletBinding()]
param(
    [switch]$SkipApi
)

$ErrorActionPreference = 'Stop'

function Invoke-DidaSafe {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $output = & dida @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    [pscustomobject]@{
        ExitCode = $exitCode
        Text = ($output -join "`n")
    }
}

function Get-JsonShape {
    param(
        [Parameter(Mandatory)]
        [string]$CommandName,
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    try {
        $result = Invoke-DidaSafe -Arguments $Arguments
        if ($result.ExitCode -ne 0) {
            return [pscustomobject]@{
                command = $CommandName
                ok = $false
                count = $null
                fields = @()
                error = "dida exited with code $($result.ExitCode)"
            }
        }

        $trimmed = $result.Text.Trim()
        if ($trimmed.Length -eq 0) {
            return [pscustomobject]@{
                command = $CommandName
                ok = $true
                count = 0
                fields = @()
                error = $null
            }
        }

        $parsed = $trimmed | ConvertFrom-Json -ErrorAction Stop
        $count = 1
        $fields = @()

        if ($parsed -is [array]) {
            $count = $parsed.Count
            if ($count -gt 0) {
                $fields = @($parsed[0].PSObject.Properties.Name)
            }
        }
        else {
            $fields = @($parsed.PSObject.Properties.Name)
        }

        [pscustomobject]@{
            command = $CommandName
            ok = $true
            count = $count
            fields = $fields
            error = $null
        }
    }
    catch {
        [pscustomobject]@{
            command = $CommandName
            ok = $false
            count = $null
            fields = @()
            error = $_.Exception.GetType().Name
        }
    }
}

$dida = Get-Command dida -ErrorAction SilentlyContinue
if (-not $dida) {
    [pscustomobject]@{
        ok = $false
        error = 'dida command not found'
    } | ConvertTo-Json -Depth 8
    exit 1
}

$versionResult = Invoke-DidaSafe -Arguments @('--version')
$authResult = Invoke-DidaSafe -Arguments @('auth', 'status')
$loggedIn = $authResult.Text -match '已登录'

$checks = @()
if ($loggedIn -and -not $SkipApi) {
    $checks += Get-JsonShape -CommandName 'project list' -Arguments @('project', 'list', '--json')
    $checks += Get-JsonShape -CommandName 'tag list' -Arguments @('tag', 'list', '--json')
    $checks += Get-JsonShape -CommandName 'habit list' -Arguments @('habit', 'list', '--json')
    $checks += Get-JsonShape -CommandName 'countdown list' -Arguments @('countdown', 'list', '--json')
}

$result = [pscustomobject]@{
    ok = ($versionResult.ExitCode -eq 0 -and ($authResult.ExitCode -eq 0) -and (@($checks | Where-Object { -not $_.ok }).Count -eq 0))
    didaSource = $dida.Source
    version = $versionResult.Text.Trim()
    loggedIn = [bool]$loggedIn
    apiSkipped = [bool]($SkipApi -or -not $loggedIn)
    readOnlyChecks = $checks
}

$result | ConvertTo-Json -Depth 8
if (-not $result.ok) {
    exit 1
}
