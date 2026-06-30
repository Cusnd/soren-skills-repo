---
name: flomo-tag-maintainer
description: Use when Codex needs to search, normalize, plan, or explicitly rename Flomo tags using the current Flomo MCP. Trigger on Flomo tag cleanup, tag search, tag naming, tag consolidation, and precise tag rename requests. This skill cannot inspect affected memos or the full tag tree because the current MCP only exposes tag_search and tag_rename.
---

# Flomo Tag Maintainer

Use this skill for tag search and carefully approved tag renames.

## Workflow

1. Call `get_tag_guide` before tag planning or tag mutation.
2. Use `tag_search` when the user gives a keyword or an approximate old tag.
3. Normalize candidate tags according to the guide.
4. For rename requests, identify `old_tag`, `new_tag`, and optional `max_memos`.
5. If approval is not explicit, present the rename plan and stop.
6. If approval is explicit and the request is precise, call `tag_rename`.

## Safety Rules

- Treat `tag_rename` as a batch write operation.
- Do not rename tags from vague instructions such as "clean these up" without a precise old and new tag.
- Explain that the current MCP cannot preview affected memos, return affected counts, or inspect the full tag tree.
- Prefer exact tags returned by `tag_search`.
- Prefer `max_memos` when the user wants a bounded test or limited blast radius.
- Do not intentionally blank or delete a tag unless Soren explicitly asks and the MCP supports the operation.
- Never expose credentials, auth headers, MCP config, or private implementation details.

## Rename Inputs

- `old_tag`: the exact tag to replace, preferably including `#` if returned that way.
- `new_tag`: the exact replacement tag. Use `/` for hierarchy when appropriate.
- `max_memos`: optional cap for a bounded rename.

## Completion Shape

Return a short status:

```json
{
  "skill": "flomo-tag-maintainer",
  "status": "complete",
  "checks": {
    "tag_guide_checked": true,
    "search_used_when_needed": true,
    "rename_approved": true,
    "secrets_redacted": true
  },
  "old_tag": null,
  "new_tag": null,
  "failure_reason": null
}
```

Use `partial` when search or planning succeeds but approval is missing. Use `failed` when the requested tag operation needs unavailable read or preview capabilities.
