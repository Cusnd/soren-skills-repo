---
name: flomo-memo-create
description: Use when Codex needs to draft or create a new Flomo memo from user-provided content using the current Flomo MCP. Trigger when the user asks to save, create, write, capture, or send a note to Flomo. This skill only creates new memos; it cannot read, search, update, delete, or export existing Flomo memos.
---

# Flomo Memo Create

Use this skill to turn user-provided material into one new Flomo memo, or into a ready-to-create draft when the user has not approved a write.

## Workflow

1. Confirm the user provided the memo content or enough context to draft it.
2. Determine whether the user explicitly asked to create the memo in Flomo.
3. Call `get_format_guide` before finalizing content.
4. If tags are requested, implied, or being normalized, call `get_tag_guide`.
5. Convert unsupported markup into Flomo-supported content.
6. If write approval is explicit, call `memo_create`.
7. If write approval is not explicit, return the draft and say it has not been created.

## Content Rules

- Use plain paragraphs separated by blank lines.
- Use only formatting allowed by the latest `get_format_guide`.
- Convert headings into plain text labels or bold lines.
- Convert code blocks, block quotes, tables, images, and unsupported Markdown into plain text or lists.
- Convert Markdown links into visible plain URLs when the URL matters.
- Keep tags inline in the memo body.
- Do not invent source facts, dates, links, or tags.
- Do not include credentials, auth headers, MCP config, or private implementation details.

## Tags

- Prefer existing user-provided tags.
- Normalize tags according to `get_tag_guide`.
- Use `/` for hierarchy when useful.
- Avoid spaces and unsupported characters.
- If the user asks for tag reuse and gives a likely keyword, use `tag_search`.
- Do not create a large new taxonomy during memo creation.

## Write Rules

- Treat `memo_create` as a write operation.
- Call `memo_create` only when the user clearly asks to create or save the memo in Flomo.
- Do not call write tools for draft, review, rewrite, preview, or "what would you save" requests.
- After creation, report the returned id or status when available and keep the response brief.

## Completion Shape

Return a short status:

```json
{
  "skill": "flomo-memo-create",
  "status": "complete",
  "checks": {
    "format_checked": true,
    "tag_guide_checked_when_needed": true,
    "write_approved": true,
    "secrets_redacted": true
  },
  "created_id": null,
  "failure_reason": null
}
```

Use `partial` when only a draft was produced. Use `failed` when content is missing, the MCP is unavailable, or a requested write is unsafe.
