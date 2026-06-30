# Executors: CLI And MCP

Use this reference to decide whether to operate through `@suibiji/dida-cli` or the connected DIDA MCP server.

## Official MCP Facts

Official DIDA MCP documentation states:

- Server URL: `https://mcp.dida365.com`
- Transport: Streamable HTTP
- Authentication: OAuth and Bearer Token are supported
- Codex can add it through app MCP settings or `codex mcp add dida365 --url https://mcp.dida365.com`
- Officially documented broad tool categories: task query, list/project management, task management, habit management, focus record management, and countdown query

The public docs do not expose exact MCP tool names or schemas. Do not invent names. Inspect and use whatever tools the active MCP client actually exposes.

Primary docs:

- DIDA MCP help: https://help.dida365.com/articles/7438132116019216384
- DIDA CLI npm: https://www.npmjs.com/package/%40suibiji/dida-cli

## Routing Matrix

| Need | Preferred executor | Reason |
|---|---|---|
| Installed CLI health, auth state, command help | CLI | Reproducible local terminal checks. |
| Read projects/tags/habits/countdowns with JSON | CLI | Known commands with `--json`; easy to parse. |
| Read or mutate a known task with known project/task IDs | CLI | Deterministic ID-based operations. |
| Create/update/move/delete temporary validation project/task/comment/column | CLI | Covered by reversible smoke script. |
| Fuzzy search by natural language, broad semantic matching, ambiguous target selection | MCP | MCP can expose higher-level account-aware tools; CLI has no true `task search`. |
| Complex schema-sensitive task create/update, especially subtasks/checklists/columns/recurrence/tags | MCP first | CLI coverage is partial and options may not cover all DIDA fields. |
| Tag writes | MCP first | CLI has `tag list/create` but no known tag delete/update path. |
| Habit writes/checkins | MCP first | CLI has create/update/checkin but no known delete/archive cleanup path. |
| Countdown writes | MCP first | CLI only exposes countdown list. |
| Focus records | CLI or MCP | CLI has create/delete; use MCP if richer schema or semantic selection is needed. |
| Auth logout | Confirm, then CLI only if requested | Destructive local auth change. |

## CLI Operating Rules

Verify before use:

```powershell
dida --version
dida auth status
```

Prefer JSON:

```powershell
dida project list --json
dida tag list --json
dida habit list --json
dida countdown list --json
```

Load `references/cli-commands.md` for exact command syntax and `references/data-formats.md` for fields, priorities, reminders, recurrence, and date formats.

Known CLI limitations that should trigger MCP fallback:

- no `task search` command; only filters and ID-based gets;
- no known tag delete/update command;
- no known habit delete/archive command;
- countdown is list-only;
- project group/column support is partial;
- some task schema fields may not be exposed as flags;
- tag names with spaces/uppercase can fail in the current CLI/API combination; avoid creating real tags through CLI unless explicitly testing with manual cleanup.

## MCP Operating Rules

Use the connected DIDA MCP when the request needs natural-language matching, rich schema fields, or surfaces the CLI cannot safely cover.

Before using MCP:

1. Confirm the client exposes a DIDA MCP server/tool set.
2. Use OAuth or a user-approved Bearer Token flow from the client; do not embed secrets in this skill.
3. Inspect available tool names/schemas at runtime.
4. Use privacy-minimal reads: inventory first, candidate tasks second, details only when needed.

If MCP is unavailable, fall back to CLI only for supported low-risk operations. Otherwise report the gap and provide a cleaned proposal.

## Parallelism And Consistency

Parallelize independent reads only when the active executor is stable under concurrent calls, for example:

- project/list inventory;
- tag inventory;
- habit inventory;
- countdown list;
- overdue/today/upcoming task reads when the executor supports independent queries.

For the local `dida` CLI, prefer sequential calls or very small bounded batches. Multiple concurrent `dida` processes can produce transient API `fetch failed` errors even when the same commands succeed sequentially. Hermes can still parallelize reasoning, cleaning, and route planning, but should keep actual CLI calls conservative. Prefer MCP for broad parallel read fan-out when the connected client exposes stable tools.

Serialize writes touching the same object family:

- task create/update/move/comment/complete/delete;
- project/list/group/column create/update/delete;
- tag/habit/focus/countdown changes.

Do not mutate the same object through CLI and MCP in the same operation chain. Pick one executor, verify, then move on.

## Reversible Validation

Read-only smoke is the default:

```powershell
pwsh -NoLogo -NoProfile -File ".\scripts\dida-smoke.ps1"
```

Reversible CLI write smoke requires explicit authorization:

```powershell
pwsh -NoLogo -NoProfile -File ".\scripts\dida-write-smoke.ps1" -ConfirmWrites
```

It creates disposable `codex-smoke-...` project/group/task/comment/column objects, deletes them in reverse order, and verifies no temporary project or group remains.

Do not run manual cleanup coverage by default:

```powershell
pwsh -NoLogo -NoProfile -File ".\scripts\dida-write-smoke.ps1" -ConfirmWrites -IncludeManualCleanupObjects
```

That mode may create tag/habit objects that the CLI cannot delete. It is allowed only when the user explicitly accepts manual cleanup, and the final response must list every object requiring deletion.
