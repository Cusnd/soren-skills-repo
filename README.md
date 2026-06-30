# Soren Skills Repo

A public workspace for maintaining Codex skills, Model Context Protocol (MCP) servers, and supporting runtime projects.

## Repository Layout

- `skills/` - Production skill folders. Each skill folder should contain a required `SKILL.md` and optional bundled resources.
- `mcp/servers/` - MCP server projects that expose tools, resources, or prompts.
- `workers/` - Cloudflare Worker projects used by skills or MCP tools.
- `templates/skill/` - Starter structure for a new skill.
- `templates/mcp-server-typescript/` - Starter TypeScript stdio MCP server.
- `docs/` - Repository conventions, authoring notes, and publishing guidance.
- `scripts/validate-repo.mjs` - Lightweight structural validation for skills and MCP server folders.

## Current Inventory

### Skills

| Skill | Folder | Purpose |
| --- | --- | --- |
| `autodl-api` | `skills/autodl-api/` | Documents AutoDL API workflows for GPU instance and elastic deployment automation. |
| `dida-cli` | `skills/dida-cli/` | Provides cautious terminal workflows for the `@suibiji/dida-cli` Dida365/TickTick command-line tool. |
| `dida365-task-manager` | `skills/dida365-task-manager/` | Routes natural-language Dida365/TickTick todo requests across CLI and MCP executors. |
| `flomo-daily-review-writer` | `skills/flomo-daily-review-writer/` | Writes evidence-grounded Chinese daily reviews from user-provided Flomo memo exports or copied notes. |
| `flomo-mcp-guide` | `skills/flomo-mcp-guide/` | Documents the safe workflow boundary for the current Flomo MCP tool surface. |
| `flomo-memo-create` | `skills/flomo-memo-create/` | Drafts or creates new Flomo memos from user-provided content using the current MCP. |
| `flomo-tag-maintainer` | `skills/flomo-tag-maintainer/` | Searches, normalizes, plans, and explicitly renames Flomo tags through the current MCP. |
| `powershell-shell` | `skills/powershell-shell/` | Guides PowerShell 5.1 and PowerShell 7 command authoring, quoting, error handling, and safety. |
| `wxarticle-archive` | `skills/wxarticle-archive/` | Archives public HTTPS webpages into Markdown, captures screenshots, and keeps a specialized legacy WeChat article mode. |

### MCP Servers

| MCP server | Folder | Status |
| --- | --- | --- |
| None yet | `mcp/servers/` | Reserved for future production MCP server projects. |

### Supporting Runtimes

| Runtime project | Folder | Used by |
| --- | --- | --- |
| `web-archive-api` | `workers/wxarticle-archive-api/` | Cloudflare Worker API for generic webpage crawling, screenshots, and legacy WeChat archival. |

### Templates

| Template | Folder | Purpose |
| --- | --- | --- |
| Skill template | `templates/skill/` | Starter structure for a new Codex skill. |
| TypeScript MCP server template | `templates/mcp-server-typescript/` | Starter TypeScript stdio MCP server. |

## Quick Start

Validate the repository:

```bash
npm run validate
```

Create a new skill:

```bash
cp -R templates/skill skills/my-skill
```

Then edit:

- `skills/my-skill/SKILL.md`
- `skills/my-skill/agents/openai.yaml`
- any needed `scripts/`, `references/`, or `assets/`

Create a new Worker project:

```bash
mkdir -p workers/my-worker
```

Include a README, runnable manifest, source files, tests, migrations where needed, and only example deployment configuration. Keep real `wrangler.jsonc`, `.dev.vars`, API keys, account IDs, and generated bundles out of Git.

Create a new MCP server:

```bash
cp -R templates/mcp-server-typescript mcp/servers/my-server
```

Then update the package name, server name, README, and tool/resource/prompt implementations.

## Repository Safety Rules

- Do not commit secrets, private tokens, API keys, local credentials, or personal data.
- Keep skill `SKILL.md` files concise and procedural.
- Put detailed skill reference material in `references/`, reusable code in `scripts/`, and output assets in `assets/`.
- Prefer small, testable MCP tools with clear input schemas and predictable responses.
- Put real Cloudflare deployment config in ignored `wrangler.jsonc`; commit only sanitized `wrangler.example.jsonc`.
- Run `npm run validate` before publishing or opening a pull request.

## License

This repository is released under the MIT License. Change `LICENSE` if you prefer another publishing model.
