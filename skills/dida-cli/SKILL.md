---
name: dida-cli
description: Use DIDA CLI (`@suibiji/dida-cli`) to safely inspect and manage Dida365/TickTick tasks, projects, tags, habits, focus records, countdowns, and comments from the terminal. Use when the user asks Codex or Hermes to install, authenticate, explore, query, create, update, complete, move, or delete DIDA/Dida365/滴答清单 items via the `dida` command, or when an AI agent needs a cautious command-line workflow around DIDA Open API data.
---

# DIDA CLI

Use the globally installed `dida` command to work with 滴答清单/Dida365 through `@suibiji/dida-cli`.
Default to read-only inspection, prefer JSON output for agent parsing, and require explicit user confirmation before destructive or broad write operations. Real-account write validation is allowed only when the user explicitly authorizes it and every created temporary object is cleaned up before completion.

## Quick Start

1. Verify the command:

```powershell
dida --version
dida --help
```

2. Check authentication without exposing the token:

```powershell
dida auth status
```

If not logged in, prefer OAuth:

```powershell
dida auth login
```

This opens a browser and listens on `http://localhost:8766/callback` for up to 3 minutes. If the browser flow is impossible, use `dida auth token <token>` only when the user explicitly provides or approves the token source. Never print, commit, or package `~/.config/dida-cli/config.json`.

3. Start by discovering IDs:

```powershell
dida project list --json
dida tag list --json
dida habit list --json
dida countdown list --json
```

## Operating Rules

- Prefer `--json` whenever available; parse JSON instead of scraping colored human output.
- Resolve project, task, habit, focus, and comment IDs before writes. Most task operations require both `projectId` and `taskId`.
- Use `Asia/Shanghai` as the default user-facing timezone unless the user specifies another timezone. DIDA timestamps commonly use ISO strings like `2026-06-30T09:00:00+0800`.
- Treat these as write operations that need clear user intent: create, update, complete, delete, move, comment add/delete, habit checkin, focus create/delete, auth logout.
- Confirm before deletes, bulk moves, broad task updates, or actions affecting multiple projects. State the exact command and affected IDs before running it.
- For reversible validation, create only objects with a generated `codex-smoke-...` prefix, delete them in reverse order, and verify no objects with that prefix remain.
- Do not claim the environment is restored if cleanup partially fails. Report the leftover temporary object type and ID.
- Keep real task/project names out of logs and deliverables unless the user asks for them. Summarize counts and field names for diagnostics.
- If a command fails with `未找到 access token`, run `dida auth status` and guide OAuth login.

## References

Load only the reference needed for the current task:

- `references/commands.md`: complete command matrix, options, endpoint mapping, and examples.
- `references/data-formats.md`: JSON fields, priorities, statuses, reminders, RRULE, focus types, and date formats.
- `references/agent-practices.md`: official/community practice notes for safe agent use.

## Smoke Test

Use `scripts/dida-smoke.ps1` to verify the CLI without exposing account content:

```powershell
pwsh -NoLogo -NoProfile -File ".\scripts\dida-smoke.ps1"
```

The script reports version, auth state, and read-only JSON counts/fields. It does not print task, project, tag, habit, or countdown names.

Use `scripts/dida-write-smoke.ps1` only after explicit user authorization for reversible real-account writes:

```powershell
pwsh -NoLogo -NoProfile -File ".\scripts\dida-write-smoke.ps1" -ConfirmWrites
```

The write smoke creates temporary projects, a project group, a task, a comment, and a column with a unique `codex-smoke-...` prefix, then deletes everything it created and verifies no prefixed projects or groups remain. It skips tags and habits by default because this CLI has create/update commands but no delete commands for them; countdown is list-only.

Use manual-cleanup mode only when the user explicitly authorizes leaving test objects for them to delete:

```powershell
pwsh -NoLogo -NoProfile -File ".\scripts\dida-write-smoke.ps1" -ConfirmWrites -IncludeManualCleanupObjects
```

Manual-cleanup mode creates a lower-case `codexsmokedeleteme...` test tag and a habit named with `TEST DELETE ME`, reports them under `manualCleanup`, and performs only a read-only countdown list check.
