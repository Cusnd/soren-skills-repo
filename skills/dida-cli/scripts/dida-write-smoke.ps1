[CmdletBinding()]
param(
    [switch]$ConfirmWrites,
    [switch]$IncludeFocus,
    [switch]$IncludeManualCleanupObjects
)

$ErrorActionPreference = 'Stop'

function Invoke-DidaCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Name,
        [Parameter(Mandatory)]
        [string[]]$Arguments,
        [switch]$Json
    )

    $output = & dida @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "dida command failed: $Name (exit $exitCode)"
    }

    $text = ($output -join "`n").Trim()
    if (-not $Json) {
        return [pscustomobject]@{
            command = $Name
            exitCode = $exitCode
        }
    }

    if ($text.Length -eq 0) {
        return $null
    }

    try {
        return $text | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "dida command did not return valid JSON: $Name"
    }
}

function Add-Step {
    param([string]$Name)
    $script:steps += $Name
}

function Add-Cleanup {
    param(
        [string]$Type,
        [string]$Id,
        [bool]$Ok,
        [string]$Message = $null
    )

    $script:cleanup += [pscustomobject]@{
        type = $Type
        id = $Id
        ok = $Ok
        message = $Message
    }

    if (-not $Ok) {
        $script:leftovers += [pscustomobject]@{
            type = $Type
            id = $Id
            reason = $Message
        }
    }
}

function Add-ManualCleanup {
    param(
        [string]$Type,
        [string]$Id,
        [string]$Name,
        [string]$Reason
    )

    $script:manualCleanup += [pscustomobject]@{
        type = $Type
        id = $Id
        name = $Name
        reason = $Reason
    }
}

function Remove-IfNeeded {
    param(
        [string]$Type,
        [string]$Id,
        [string[]]$Arguments
    )

    if ([string]::IsNullOrWhiteSpace($Id)) {
        return
    }

    try {
        Invoke-DidaCommand -Name "cleanup $Type" -Arguments $Arguments | Out-Null
        Add-Cleanup -Type $Type -Id $Id -Ok $true
    }
    catch {
        Add-Cleanup -Type $Type -Id $Id -Ok $false -Message $_.Exception.Message
    }
}

function Find-PrefixedObjects {
    param(
        [Parameter(Mandatory)]
        [string]$Type,
        [Parameter(Mandatory)]
        [string[]]$Arguments,
        [Parameter(Mandatory)]
        [string]$Prefix
    )

    try {
        $items = Invoke-DidaCommand -Name "verify $Type" -Arguments $Arguments -Json
        $matches = @($items | Where-Object { $_.name -like "$Prefix*" } | ForEach-Object {
            [pscustomobject]@{
                type = $Type
                id = $_.id
            }
        })
        return $matches
    }
    catch {
        return @([pscustomobject]@{
            type = $Type
            id = $null
            reason = $_.Exception.Message
        })
    }
}

if (-not $ConfirmWrites) {
    [pscustomobject]@{
        ok = $false
        error = 'Refusing to perform real-account writes without -ConfirmWrites.'
    } | ConvertTo-Json -Depth 8
    exit 2
}

$dida = Get-Command dida -ErrorAction SilentlyContinue
if (-not $dida) {
    [pscustomobject]@{
        ok = $false
        error = 'dida command not found'
    } | ConvertTo-Json -Depth 8
    exit 1
}

$authOutput = & dida auth status 2>&1
if ($LASTEXITCODE -ne 0 -or (($authOutput -join "`n") -notmatch '已登录')) {
    [pscustomobject]@{
        ok = $false
        error = 'dida is not logged in'
    } | ConvertTo-Json -Depth 8
    exit 1
}

$prefix = "codex-smoke-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$(([guid]::NewGuid().ToString('N')).Substring(0, 8))"
$steps = @()
$cleanup = @()
$leftovers = @()
$manualCleanup = @()
$created = [ordered]@{}

$groupId = $null
$projectAId = $null
$projectBId = $null
$columnId = $null
$taskId = $null
$taskProjectId = $null
$commentId = $null
$focusId = $null
$commentDeleted = $false
$taskDeleted = $false
$projectADeleted = $false
$projectBDeleted = $false
$groupDeleted = $false
$focusDeleted = $false
$failure = $null

try {
    $group = Invoke-DidaCommand -Name 'project group create' -Arguments @('project', 'group', 'create', '--name', "$prefix-group", '--json') -Json
    $groupId = $group.id
    $created.groupId = $groupId
    Add-Step 'created project group'

    $projectA = Invoke-DidaCommand -Name 'project create A' -Arguments @('project', 'create', '--name', "$prefix-project-a", '--view-mode', 'kanban', '--kind', 'TASK', '--json') -Json
    $projectAId = $projectA.id
    $created.projectAId = $projectAId
    Add-Step 'created project A'

    $projectB = Invoke-DidaCommand -Name 'project create B' -Arguments @('project', 'create', '--name', "$prefix-project-b", '--kind', 'TASK', '--json') -Json
    $projectBId = $projectB.id
    $created.projectBId = $projectBId
    Add-Step 'created project B'

    $column = Invoke-DidaCommand -Name 'project column create' -Arguments @('project', 'column', 'create', $projectAId, '--name', "$prefix-column", '--json') -Json
    $columnId = $column.id
    $created.columnId = $columnId
    Add-Step 'created project column'

    Invoke-DidaCommand -Name 'project column update' -Arguments @('project', 'column', 'update', $projectAId, $columnId, '--name', "$prefix-column-updated", '--json') -Json | Out-Null
    Add-Step 'updated project column'

    $task = Invoke-DidaCommand -Name 'task create' -Arguments @('task', 'create', '--title', "$prefix-task", '--project', $projectAId, '--content', 'Temporary DIDA CLI smoke task.', '--priority', '1', '--json') -Json
    $taskId = $task.id
    $taskProjectId = $projectAId
    $created.taskId = $taskId
    Add-Step 'created task'

    Invoke-DidaCommand -Name 'task update' -Arguments @('task', 'update', $taskId, '--id', $taskId, '--project', $projectAId, '--title', "$prefix-task-updated", '--estimated-duration', '60', '--estimated-pomo', '1', '--json') -Json | Out-Null
    Add-Step 'updated task'

    $comment = Invoke-DidaCommand -Name 'task comment add' -Arguments @('task', 'comment', 'add', $projectAId, $taskId, '--title', "$prefix-comment", '--json') -Json
    $commentId = $comment.id
    $created.commentId = $commentId
    Add-Step 'added task comment'

    $comments = @(Invoke-DidaCommand -Name 'task comment list' -Arguments @('task', 'comment', 'list', $projectAId, $taskId, '--json') -Json)
    $created.commentCountAfterAdd = $comments.Count
    Add-Step 'listed task comments'

    Invoke-DidaCommand -Name 'task comment delete' -Arguments @('task', 'comment', 'delete', $projectAId, $taskId, $commentId) | Out-Null
    $commentDeleted = $true
    Add-Step 'deleted task comment'

    Invoke-DidaCommand -Name 'task move' -Arguments @('task', 'move', '--from', $projectAId, '--to', $projectBId, '--task', $taskId, '--json') -Json | Out-Null
    $taskProjectId = $projectBId
    Add-Step 'moved task'

    Invoke-DidaCommand -Name 'task get after move' -Arguments @('task', 'get', $projectBId, $taskId, '--json') -Json | Out-Null
    Add-Step 'verified moved task'

    if ($IncludeFocus) {
        $startTime = (Get-Date).AddMinutes(-35).ToString('yyyy-MM-ddTHH:mm:ss+0800')
        $endTime = (Get-Date).AddMinutes(-10).ToString('yyyy-MM-ddTHH:mm:ss+0800')
        $focus = Invoke-DidaCommand -Name 'focus create' -Arguments @('focus', 'create', '--type', 'pomodoro', '--task-id', $taskId, '--note', "$prefix-focus", '--start-time', $startTime, '--end-time', $endTime, '--duration', '1500', '--json') -Json
        $focusId = $focus.id
        $created.focusId = $focusId
        Add-Step 'created focus record'
    }

    Invoke-DidaCommand -Name 'task delete' -Arguments @('task', 'delete', $taskProjectId, $taskId) | Out-Null
    $taskDeleted = $true
    Add-Step 'deleted task'

    if ($IncludeManualCleanupObjects) {
        $tagName = "codexsmokedeleteme$(Get-Date -Format 'yyyyMMddHHmmss')$(([guid]::NewGuid().ToString('N')).Substring(0, 6))"
        $tagLabel = $tagName
        $tag = Invoke-DidaCommand -Name 'tag create manual cleanup' -Arguments @('tag', 'create', '--name', $tagName, '--label', $tagLabel, '--json') -Json
        Add-ManualCleanup -Type 'tag' -Id $tag.name -Name $tag.label -Reason 'CLI has tag create but no tag delete command; delete this lower-case codexsmokedeleteme test tag manually.'
        Add-Step 'created manual-cleanup tag'

        $habitName = "$prefix TEST DELETE ME habit"
        $habit = Invoke-DidaCommand -Name 'habit create manual cleanup' -Arguments @('habit', 'create', '--name', $habitName, '--repeat', 'RRULE:FREQ=DAILY;INTERVAL=1', '--goal', '1', '--unit', 'test', '--json') -Json
        Add-ManualCleanup -Type 'habit' -Id $habit.id -Name $habit.name -Reason 'CLI has habit create/update but no habit delete command; delete this test habit manually.'
        Add-Step 'created manual-cleanup habit'

        $countdowns = @(Invoke-DidaCommand -Name 'countdown list read-only' -Arguments @('countdown', 'list', '--json') -Json)
        $created.countdownReadOnlyCount = $countdowns.Count
        Add-Step 'listed countdowns read-only'
    }
}
catch {
    $failure = $_.Exception.Message
}
finally {
    if ($focusId -and -not $focusDeleted) {
        Remove-IfNeeded -Type 'focus' -Id $focusId -Arguments @('focus', 'delete', $focusId, '--type', 'pomodoro')
        $focusDeleted = $true
    }

    if ($commentId -and -not $commentDeleted -and $taskId -and $taskProjectId) {
        Remove-IfNeeded -Type 'task-comment' -Id $commentId -Arguments @('task', 'comment', 'delete', $taskProjectId, $taskId, $commentId)
        $commentDeleted = $true
    }

    if ($taskId -and -not $taskDeleted -and $taskProjectId) {
        Remove-IfNeeded -Type 'task' -Id $taskId -Arguments @('task', 'delete', $taskProjectId, $taskId)
        $taskDeleted = $true
    }

    if ($projectBId -and -not $projectBDeleted) {
        Remove-IfNeeded -Type 'project' -Id $projectBId -Arguments @('project', 'delete', $projectBId)
        $projectBDeleted = $true
    }

    if ($projectAId -and -not $projectADeleted) {
        Remove-IfNeeded -Type 'project' -Id $projectAId -Arguments @('project', 'delete', $projectAId)
        $projectADeleted = $true
    }

    if ($groupId -and -not $groupDeleted) {
        Remove-IfNeeded -Type 'project-group' -Id $groupId -Arguments @('project', 'group', 'delete', $groupId)
        $groupDeleted = $true
    }
}

$prefixedLeftovers = @()
$prefixedLeftovers += Find-PrefixedObjects -Type 'project' -Arguments @('project', 'list', '--json') -Prefix $prefix
$prefixedLeftovers += Find-PrefixedObjects -Type 'project-group' -Arguments @('project', 'group', 'list', '--json') -Prefix $prefix
$prefixedLeftovers = @($prefixedLeftovers | Where-Object { $_.id -or $_.reason })

foreach ($item in $prefixedLeftovers) {
    $leftovers += $item
}

$ok = (-not $failure) -and (@($leftovers).Count -eq 0)
$result = [pscustomobject]@{
    ok = [bool]$ok
    prefix = $prefix
    includeFocus = [bool]$IncludeFocus
    includeManualCleanupObjects = [bool]$IncludeManualCleanupObjects
    steps = $steps
    created = $created
    cleanup = $cleanup
    manualCleanup = $manualCleanup
    leftovers = @($leftovers)
    failure = $failure
}

$result | ConvertTo-Json -Depth 10
if (-not $ok) {
    exit 1
}
