---
name: powershell-shell
description: Use when Codex runs, writes, translates, debugs, or reviews commands for Windows PowerShell 5.1 or PowerShell 7+ (pwsh). Prevent Bash syntax mistakes and handle PowerShell quoting, paths, native executable arguments, command failures, encoding, structured output, and destructive-operation safety correctly.
---

# PowerShell Shell Adapter

Use this skill whenever the active command shell is Windows PowerShell or PowerShell 7+. Treat PowerShell as its own shell, not as Bash with different executable names.

## Core Rules

- Prefer `pwsh` / PowerShell 7+ when available.
- Do not use Bash-only syntax: heredocs with `<<`, `export NAME=value`, `$PATH`, `rm -rf`, `mkdir -p`, `touch`, `which`, process substitution, or Bash arrays.
- Prefer explicit PowerShell cmdlets and full parameter names in scripts.
- Use structured objects and JSON when output will be parsed by an agent.
- Check native executable exit codes with `$LASTEXITCODE`; native tools do not throw PowerShell exceptions by default.
- Guard destructive operations with target verification and `-WhatIf` when available.

## Command Style

Use cmdlets in scripts and instructions:

```powershell
Get-ChildItem -Path . -Recurse -File
Get-Content -Path "package.json"
Select-String -Path "src\*.ps1" -Pattern "TODO"
```

Avoid relying on aliases in reusable commands:

```powershell
# Avoid in scripts
ls
cat
rm
cp
mv
grep
```

## Paths and Execution

Quote paths that may contain spaces:

```powershell
Set-Location -Path "C:\Program Files"
```

Build paths with `Join-Path`:

```powershell
$path = Join-Path $PWD.Path "src"
```

Run scripts or executables in the current directory with `.\`:

```powershell
.\build.ps1
.\tool.exe
```

Run a command path stored in a variable with the call operator:

```powershell
$exe = "C:\Program Files\Git\bin\git.exe"
& $exe --version
```

## Variables and Environment

Use PowerShell variables:

```powershell
$name = "demo"
```

Use `$Env:` for environment variables:

```powershell
$Env:NODE_ENV = "development"
Write-Output $Env:PATH
```

Do not write Bash syntax:

```powershell
# Wrong in PowerShell
export NODE_ENV=development
echo $PATH
```

## Command Chaining and Errors

PowerShell 7 supports `&&` and `||`, but Windows PowerShell 5.1 does not. Prefer explicit checks in commands that may run on either version:

```powershell
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

For cmdlets, make important failures terminating:

```powershell
$ErrorActionPreference = "Stop"

try {
    New-Item -ItemType Directory -Path "dist" -Force
}
catch {
    Write-Error $_
    exit 1
}
```

## Native Executables

Native tools such as `git`, `npm`, `node`, `python`, `cargo`, `go`, `dotnet`, `ssh`, and `curl.exe` usually report failure through exit codes:

```powershell
git status
if ($LASTEXITCODE -ne 0) {
    throw "git failed with exit code $LASTEXITCODE"
}
```

Use argument arrays for complex native command arguments:

```powershell
$args = @("status", "--short")
& git @args
```

Use `curl.exe` when the real curl binary is intended. In Windows PowerShell, `curl` may resolve to an alias.

Use `--%` only for native Windows commands with difficult parsing, and never with PowerShell cmdlets:

```powershell
icacls C:\Temp --% /grant Users:(OI)(CI)F
```

## Quoting and Multiline Input

Single quotes are literal; double quotes expand variables:

```powershell
'hello $name'
"hello $name"
"${name}_suffix"
```

Do not use Bash heredocs:

```powershell
# Wrong in PowerShell
python <<'PY'
print("hello")
PY
```

For inline scripts, pipe a PowerShell here-string into the interpreter:

```powershell
@'
print("hello")
'@ | python -
```

For generated temporary scripts, write a file under the workspace and run it explicitly:

```powershell
$scriptPath = Join-Path $PWD.Path "work\script.ps1"
Set-Content -LiteralPath $scriptPath -Value $script -Encoding utf8NoBOM
pwsh -NoLogo -NoProfile -File $scriptPath
```

Avoid backtick line continuation. Prefer splatting:

```powershell
$params = @{
    Path = "src"
    Recurse = $true
    File = $true
}
Get-ChildItem @params
```

## Output for Agents

Return structured output when another step will parse it:

```powershell
$result = [pscustomobject]@{
    ok = $true
    path = $PWD.Path
}
$result | ConvertTo-Json -Depth 10
```

Avoid parsing formatted tables:

```powershell
# Bad
Get-Process | Format-Table | Select-String node

# Good
Get-Process |
    Where-Object { $_.ProcessName -like "*node*" } |
    Select-Object Id, ProcessName, CPU |
    ConvertTo-Json -Depth 5
```

## Files and Encoding

Specify encoding when writing files:

```powershell
Set-Content -LiteralPath "file.txt" -Value $text -Encoding utf8NoBOM
```

PowerShell 7+ defaults are generally UTF-8 friendly. Windows PowerShell 5.1 may misread UTF-8 without BOM for scripts containing non-ASCII characters, so use a BOM when compatibility with 5.1 matters.

PowerShell redirection uses streams:

```powershell
command > out.txt
command 2> err.txt
command *> all.txt
command 2>&1
```

For logs, prefer explicit output handling:

```powershell
.\build.ps1 *> build.log
```

## Safety

Preview destructive cmdlets when supported:

```powershell
Remove-Item -LiteralPath "dist" -Recurse -Force -WhatIf
```

Before recursive delete or move operations, resolve and verify the absolute target stays inside the intended directory:

```powershell
$root = (Resolve-Path -LiteralPath $PWD.Path).Path
$target = (Resolve-Path -LiteralPath "dist").Path
if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify target outside workspace: $target"
}
```

For functions that modify state, support `ShouldProcess`:

```powershell
[CmdletBinding(SupportsShouldProcess)]
param([string]$Target)

if ($PSCmdlet.ShouldProcess($Target, "Remove")) {
    Remove-Item -LiteralPath $Target -Recurse -Force
}
```

## Common Translations

| Bash | PowerShell |
| --- | --- |
| `pwd` | `$PWD.Path` or `Get-Location` |
| `cd path` | `Set-Location -Path "path"` |
| `ls -la` | `Get-ChildItem -Force` |
| `cat file` | `Get-Content -Path "file"` |
| `grep text file` | `Select-String -Path "file" -Pattern "text"` |
| `rm -rf dir` | `Remove-Item -LiteralPath "dir" -Recurse -Force` |
| `cp -r a b` | `Copy-Item -Path "a" -Destination "b" -Recurse` |
| `mv a b` | `Move-Item -Path "a" -Destination "b"` |
| `mkdir -p dir` | `New-Item -ItemType Directory -Path "dir" -Force` |
| `touch file` | `New-Item -ItemType File -Path "file" -Force` |
| `echo $PATH` | `Write-Output $Env:PATH` |
| `export A=B` | `$Env:A = "B"` |
| `which node` | `Get-Command node` |
| `cmd <<'EOF'` | Pipe a PowerShell here-string or write a temp file |

## Verification Checklist

Before giving or running a PowerShell command:

1. Confirm the syntax is PowerShell, not Bash.
2. Quote paths that may contain spaces.
3. Use `.\` or `&` when executing local or variable-held paths.
4. Check `$LASTEXITCODE` after native commands that must succeed.
5. Use `-ErrorAction Stop` when cmdlet failures must be caught.
6. Return JSON or objects when output will be parsed.
7. Specify encoding when writing files.
8. Guard destructive commands with `-WhatIf`, `ShouldProcess`, or explicit path checks.
