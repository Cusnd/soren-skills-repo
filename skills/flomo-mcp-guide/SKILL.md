---
name: flomo-mcp-guide
description: Use when Codex needs to choose safe workflows for the current Flomo MCP server, especially creating Flomo memos, searching tags, renaming tags, checking Flomo formatting rules, or explaining that memo reading, memo search, updates, daily exports, tag trees, recommendations, and memory-doc workflows are not supported by the current MCP tool surface.
---

# Flomo MCP Guide

Use this skill before non-trivial Flomo MCP work. Treat the currently exposed Flomo MCP as a limited write and tag-maintenance surface, not a full read/search/export API.

## Operating Defaults

- Human: Soren.
- MCP server: `flomo`.
- Default posture: draft or inspect first. Do not create or rename anything unless Soren explicitly asks for that write action.
- Never expose tokens, auth headers, credential paths, raw private config, or credential-like strings.
- Do not write MCP configuration details into skills, reports, or user-facing artifacts.

## Current Tool Surface

- `get_format_guide`: call before drafting content for `memo_create`; follow the returned guide over older assumptions.
- `get_tag_guide`: call before creating, normalizing, organizing, or renaming tags.
- `memo_create`: create one new memo from user-provided content. Tags must be inline in the content.
- `tag_search`: search tag names by keyword when the likely tag text is known.
- `tag_rename`: batch rename tags after explicit approval.

For a compact tool table and unsupported-capability list, read `references/tools.md`.

## Unsupported With Current MCP

Do not claim that the current Flomo MCP can do any of these:

- Read or list memos.
- Search memo content.
- Fetch a memo by id.
- Update or delete an existing memo.
- Export all memos for a day.
- Prove daily coverage.
- Inspect the full tag tree.
- Fetch recommended or related memos.
- Retrieve memory docs or user profile context.

If a user asks for one of these, state the limitation plainly and ask for an external export, copied memo set, or a read-capable Flomo MCP before continuing.

## Guarded Writes

Before creating a memo:

- Confirm Soren explicitly requested the write.
- Call `get_format_guide`.
- If tags are being added or normalized, call `get_tag_guide`.
- Convert unsupported Markdown into plain paragraphs, bold text, and lists.
- Keep tags inline, such as `#inbox` or `#area/project`.

Before renaming tags:

- Confirm Soren explicitly requested the rename.
- Call `get_tag_guide`.
- Use `tag_search` to identify likely existing tags when the old tag is not exact.
- Explain that the current MCP cannot preview affected memos or counts.
- Prefer `max_memos` when Soren wants a bounded change.

## Completion Contract

When this skill is used as a stage in another workflow, return concise status information:

```json
{
  "skill": "flomo-mcp-guide",
  "status": "complete",
  "checks": {
    "tool_selected": true,
    "unsupported_capabilities_checked": true,
    "secrets_redacted": true
  },
  "failure_reason": null,
  "next_action": null
}
```

Use `partial` when a safe workflow is identified but user approval or input is missing. Use `failed` when the current MCP cannot support the requested task.
