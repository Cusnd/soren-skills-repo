---
name: dida365-task-manager
description: Use when Codex or Hermes needs to capture, route, query, update, complete, schedule, deduplicate, organize, or safely execute Dida365/TickTick tasks from natural-language todo requests. Trigger on todo/待办/记一下/提醒我/写进滴答/安排一下, routing prefixes such as 工作任务todo/工具todo/研究任务todo/灵感todo/生活用品todo/电子产品todo/吉利学院todo/极为重要todo, and requests to inspect, clean, summarize, schedule, or restructure DIDA tasks.
---

# Dida365 Task Manager

Turn natural-language Dida365/TickTick requests into clean task operations, using live DIDA inventory plus the best available executor: `dida` CLI for reproducible ID-based work and the DIDA MCP server for fuzzy, semantic, or CLI-missing capabilities.

## Fast Workflow

1. Classify intent: create, supplement, query, update, complete, delete, organize, or smoke-test.
2. Clean the user text before writing: remove routing/control words such as `todo`, `工作任务todo`, `写进滴答`, and `提醒我`; preserve meaningful content, links, constraints, and pasted requirements.
3. Read live inventory before placement or mutation. Do not hard-code list, group, column, tag, habit, or countdown names from memory.
4. Choose executor by capability:
   - Use CLI when the command is supported, target IDs are known, and the operation is low-risk or explicitly confirmed.
   - Use DIDA MCP when the request needs fuzzy search, semantic matching, schema-sensitive fields, or a capability the CLI does not expose.
   - Use MCP first for tag, habit, and countdown writes; the CLI can only partially cover these surfaces.
5. Execute and verify. Never claim a task/project/habit/tag/focus/countdown was changed unless the tool succeeded.
6. Reply in concise Chinese with action, title/object, placement, due/reminder, priority, detail status, and any cleanup or fallback notes.

For date parsing, use `Asia/Shanghai` by default. Load `references/intent-routing.md` for full rules; common reminder defaults are morning/上午 09:00, noon 12:00, afternoon 15:00, evening 20:00, and bedtime 23:00.

## Executor Routing

Use this simple gate before every tool call:

```text
can_cli && has_ids && low_risk -> CLI
needs_fuzzy_search || CLI_missing_capability || schema_sensitive -> DIDA MCP
destructive || bulk || move || auth logout -> confirm first, then one executor only
```

Reads can be parallelized when they do not depend on each other and the executor is stable under concurrent calls. The `dida` CLI may produce transient `fetch failed` errors when several CLI processes hit the API at once, so prefer sequential or tightly bounded CLI calls; use the connected DIDA MCP for richer parallel read fan-out when it exposes stable tools. Writes touching the same task, project/list, group, tag, habit, focus record, or countdown must be serialized through one executor so IDs, timestamps, and cleanup state stay coherent.

Official DIDA MCP facts: the server URL is `https://mcp.dida365.com`, transport is Streamable HTTP, and it supports OAuth and Bearer Token authentication. Official docs publish broad tool categories only; do not invent concrete MCP tool names. Use the tools actually exposed by the connected client.

## Safety Rules

- Default to read-only inspection when intent is unclear.
- Ask before deleting, bulk completing, broad moving, merging, hiding, auth logout, or any operation that could affect multiple real objects.
- Real-account write validation is allowed only after explicit user authorization. Create temporary objects with an obvious `codex-smoke-...` prefix, clean them up before completion, and report exact leftover IDs if cleanup partially fails.
- Do not print, save, package, or commit tokens. CLI auth is stored locally under `~/.config/dida-cli/config.json`; MCP tokens must come from the client or user-approved secret flow.
- Redact passwords, API keys, tokens, private keys, ID numbers, payment data, and highly sensitive personal data before saving task details.
- If a tool is unavailable, blocked, or fails, report the failure and provide the cleaned task proposal instead of pretending the DIDA operation happened.

## Reference Loading

Load only the references needed for the current request:

- `references/intent-routing.md`: trigger detection, routing prefixes, cleaning, title/detail/date/priority rules.
- `references/operations.md`: create, supplement, duplicate, query, complete, delete, organize, and reply behavior.
- `references/executors.md`: CLI vs MCP routing, official MCP connection facts, parallelism, auth, and fallback rules.
- `references/cli-commands.md`: complete `@suibiji/dida-cli` command matrix and examples.
- `references/data-formats.md`: DIDA JSON fields, priorities, reminders, RRULE, focus types, and date formats.

## Smoke Tests

Use the read-only CLI smoke as the default safety check:

```powershell
pwsh -NoLogo -NoProfile -File ".\scripts\dida-smoke.ps1"
```

Use reversible real-account write smoke only when explicitly authorized:

```powershell
pwsh -NoLogo -NoProfile -File ".\scripts\dida-write-smoke.ps1" -ConfirmWrites
```

Do not run `-IncludeManualCleanupObjects` unless the user explicitly agrees to test tag/habit surfaces that the CLI cannot fully delete. When used, report every object requiring manual deletion.

## Reply Contract

After task actions, reply briefly in Chinese:

```text
已添加/已更新/已完成：<标题>
清单：<live list/project>
分组/列：<group/column or 无/未分组>
截止/提醒：<date/time or 未设置>
优先级：<高/中/低/未设置>
详情：<已保存 / 已补充 / 已整理链接详情 / 敏感信息已脱敏 / 无详情>
结构：<单任务 / 多个独立任务 / 父任务+子任务>
执行器：<CLI / MCP / 未执行>
```

If a duplicate was avoided, say so. If cleanup partially failed, say the environment was not fully restored and list the leftover temporary object IDs.
