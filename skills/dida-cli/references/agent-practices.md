# Agent Practices For DIDA CLI

Use this reference when an AI agent is operating a real DIDA account.

## Sources To Trust

- Official help page: `https://help.dida365.com/articles/7464976698707017728`
- npm package: `https://www.npmjs.com/package/@suibiji/dida-cli`
- Developer portal: `https://developer.dida365.com/`
- Installed package source: global npm package `@suibiji/dida-cli`, version checked with `dida --version`

The official help page recommends Node.js LTS, global npm install, `dida --help`, `dida --version`, OAuth login, and token fallback from DIDA web settings.

## Safe Workflow

1. Start with `dida auth status`.
2. Run read-only discovery with `--json`: `project list`, `tag list`, `habit list`, `countdown list`.
3. For task work, find the relevant project first, then use `task filter`, `task completed`, or `project data`.
4. Before writes, restate exact target IDs and intended mutation.
5. After writes, verify with a read command and summarize the result.

Do not print raw JSON containing many personal task names unless the user explicitly asks. For diagnostics, show counts, IDs needed for the next action, or selected fields.

## Reversible Write Validation

Use `scripts/dida-write-smoke.ps1 -ConfirmWrites` only after explicit authorization for real-account writes. The script creates objects with a unique `codex-smoke-...` prefix, exercises reversible write paths, deletes everything it created in reverse order, and verifies no prefixed projects or groups remain.

The reversible smoke may test:

- project group create/delete
- project create/delete
- project column create/update, cleaned up through project deletion
- task create/update/move/delete
- task comment add/list/delete

Do not use default smoke validation for tags, habits, auth logout, or any surface without a reliable CLI cleanup path. If cleanup fails, report leftover object type and ID; do not say the environment was restored.

If the user explicitly authorizes manual cleanup objects, run `scripts/dida-write-smoke.ps1 -ConfirmWrites -IncludeManualCleanupObjects`. This creates a lower-case `codexsmokedeleteme...` tag and a habit whose name includes `TEST DELETE ME`, records them under `manualCleanup`, and expects the user to delete them in the DIDA UI or another tool. Countdown support in this CLI is list-only, so countdown validation is read-only. Tag labels must stay lower-case/simple; labels with spaces or uppercase text can fail the DIDA API.

## Confirmation Boundaries

Always confirm before:

- `task delete`
- `project delete`
- `project group delete`
- `task comment delete`
- `focus delete`
- `task move` when moving more than one task or when IDs were inferred
- broad `task update` operations
- `auth logout`

Usually no extra confirmation is needed when the user directly asks to create one clearly specified task, add one comment, or complete one explicitly identified task, but still verify the project/task ID first when ambiguity exists.

## Authentication Notes

- Prefer OAuth: `dida auth login`.
- The CLI uses OAuth scopes equivalent to task read/write access in its bundled client.
- The CLI stores the access token in `~/.config/dida-cli/config.json`.
- Do not commit or package the config file, `.env` files, screenshots containing tokens, or command logs that include token fragments.
- Current 1Password Environment MCP tools can list variable names and append variables, but they do not read existing secret values. Do not claim an API token was retrieved from 1Password unless a tool actually returned it.

## DIDA Terminology

| Chinese/UI term | CLI/API term |
| --- | --- |
| 清单 | project/list |
| 清单分组 / 文件夹 | project group |
| 看板列 | project column |
| 任务 | task |
| 检查事项 / 子任务 | checklist item |
| 标签 | tag |
| 习惯 | habit |
| 打卡 | habit checkin |
| 专注 / 番茄钟 | focus / pomodoro |
| 正计时 | focus timing |
| 倒数日 | countdown |

## Query Patterns

- "Show my projects": `dida project list --json`
- "Find active tasks in a project": `dida task filter --projects <projectId> --status 0 --json`
- "Show project board data": `dida project data <projectId> --json`
- "Show completed tasks this week": `dida task completed --projects <projectId> --start-date "<iso>" --end-date "<iso>" --json`
- "Show focus records": `dida focus list --from "<iso>" --to "<iso>" --type pomodoro --json`
- "Check habit history": `dida habit checkins --habits <habitId> --from <YYYYMMDD> --to <YYYYMMDD> --json`

## Error Handling

- `未找到 access token`: run `dida auth status`; if not logged in, use OAuth.
- `DIDA API 错误 401`: token expired or invalid; use OAuth again or ask for token fallback.
- `DIDA API 错误 403`: insufficient permission or project access; do not retry writes blindly.
- `DIDA API 错误 404`: re-check IDs and whether the task belongs to the given project.
- `--from、--to、--task 的数量必须一致`: fix `task move` triplets.
- `--estimated-pomo 必须是 0 到 60`: clamp or ask for a valid estimate.

## Packaging Hygiene

When handing this skill to another agent:

- Include `SKILL.md`, `agents/openai.yaml`, `references/`, and `scripts/`.
- Exclude local DIDA config, npm cache, command output containing personal data, `.env`, and 1Password material.
- Prefer a `.zip` built from the skill directory only.
