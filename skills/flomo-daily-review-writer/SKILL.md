---
name: flomo-daily-review-writer
description: "Use only when the user provides an external Flomo memo export, copied Flomo notes, or another explicit memo set and asks Codex to write an evidence-grounded Chinese daily review. This skill is offline only: it must not fetch Flomo data, claim complete coverage, generate HTML, upload, notify, or use the current Flomo MCP to read/search/export memos."
---

# Flomo Daily Review Writer

Use this skill to write a Chinese daily review from notes the user has already provided. The current Flomo MCP cannot read, search, or export memos, so never use this skill as proof that a Flomo day is complete.

## Inputs

- A user-provided memo export, JSON file, copied note set, or explicit list of memos.
- Optional target date and timezone from the user.
- Optional instruction about tone, length, or sections.

If no notes are provided, stop and ask for an export or copied memo set. Do not try to fetch notes from Flomo.

## Outputs

- Markdown in the location requested by the user, or inline in chat for small reviews.
- Optional completion JSON only when another workflow asks for one.

## Editorial Principles

- Write in Chinese for Soren.
- Fidelity first, interpretation second, literary expression last.
- Represent every provided memo in `原始笔记地图` or another explicit evidence section.
- Quote original memo text exactly when it carries the report's evidence.
- Separate `fact`, `inference`, and poetic expression. Use `可能`, `似乎`, `可以这样读`, or `一种读法是` for inferences.
- Mark weak links as `弱连接`.
- Do not diagnose, pathologize, moralize, or turn every emotion into a task.
- Keep vulnerable material soft and bounded.
- Serve Soren's knowledge system: diary, Notion, articles, technical docs, projects, and long-term observations.
- State when coverage is user-provided or unproven if the export does not include a completeness proof.

## Report Shape

Adapt structure to the day's material. Useful sections:

- `Flomo 每日回顾`
- `今日一句`
- `今日速览`
- `原始笔记地图`
- `今日主线`
- `今日张力`
- `情绪与需要`
- `思考与知识沉淀`
- `今天值得保留的原句`
- `可以发展成的内容`
- `明日轻推`
- `留给明天的问题`
- `我不确定的地方`
- `一段完整的今日总结`
- Optional final section when requested or suitable: `以今日基调拟作`

If writing the final creative section, identify a literary master whose temperament broadly matches the day's notes, explain the match briefly, and then write a new work grounded in Soren's notes. Prefer deceased or public-domain literary masters when possible. If choosing a modern or living author, use only broad traits and do not imitate proprietary style. Do not quote the literary master.

## Style Bans

- Do not start or end with assistant filler such as `好的`, `以下是`, or `希望对你有帮助`.
- Avoid template transitions: `首先`, `其次`, `然后`, `最后`, `总之`, `综上`, `值得注意的是`, `由此可见`, `因此`.
- Do not force all notes into one theme.
- Do not invent context beyond `memos.json`.
- Do not expose internal skill names, MCP/tool calls, model names, credential paths, or implementation details in the Markdown report body.

## Completion Contract

When a completion JSON is requested, return or write:

```json
{
  "skill": "flomo-daily-review-writer",
  "date": "YYYY-MM-DD",
  "status": "complete",
  "artifacts": ["path requested by user or inline chat"],
  "checks": {
    "input_provided_by_user": true,
    "coverage_not_overclaimed": true,
    "provided_memos_represented": true,
    "exact_quotes_present": true,
    "fact_inference_separated": true,
    "no_placeholders": true,
    "no_internal_details": true
  },
  "counts": {
    "memo_count": 0,
    "represented_memo_count": 0
  },
  "failure_reason": null,
  "next_action": null
}
```

Use `partial` if a draft exists but a quality gate fails. Use `failed` if no memo input is provided or no Markdown artifact can be written.
