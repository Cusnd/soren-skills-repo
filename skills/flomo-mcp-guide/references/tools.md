# Current Flomo MCP Tools

Use this reference when choosing or auditing calls against the current Flomo MCP tool surface.

## Available Tools

### `get_format_guide`

Purpose: fetch the current Flomo formatting rules.

Rules:

- Call before preparing content for `memo_create`.
- Follow the returned guide over older documentation.
- Current guide supports only a small Markdown subset, primarily bold text, ordered lists, unordered lists, paragraphs, inline tags, and Flomo memo URLs for backlinks.

### `get_tag_guide`

Purpose: fetch the current Flomo tag rules and naming guidance.

Rules:

- Call before creating, normalizing, organizing, or renaming tags.
- Keep tags inline in memo content.
- Avoid spaces and unsupported characters in tags.

### `memo_create`

Purpose: create one new memo from user-provided content.

Rules:

- Requires explicit user intent to create a Flomo memo.
- Call `get_format_guide` first.
- Put tags directly in `content`, such as `#inbox` or `#area/project`.
- Convert unsupported Markdown before writing.

### `tag_search`

Purpose: search tag names by keyword.

Rules:

- Use when the likely tag text is known.
- It is lighter than a full tag tree, and the current MCP does not expose a full tag tree.

### `tag_rename`

Purpose: batch rename tags.

Rules:

- Requires `old_tag`.
- Use only after explicit approval because it can affect many memos.
- Prefer an exact `old_tag` chosen from `tag_search` results.
- Pass `new_tag` for a rename. Do not intentionally delete or blank tags unless Soren explicitly asks and the tool supports it.
- Use `max_memos` when Soren requests a bounded change.

## Unsupported Legacy Capabilities

Do not treat older Flomo MCP read/export/update capabilities as available in current workflows. This includes legacy memo search, batch memo fetch, memo update/delete, full tag tree inspection, related or recommended memo retrieval, daily review retrieval, and memory/profile document retrieval.

When a user needs any of those capabilities, ask for an external export, copied memo set, or a read-capable Flomo MCP before continuing.
