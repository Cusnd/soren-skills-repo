# Soren Skills Repo

A public workspace for maintaining Codex skills and Model Context Protocol (MCP) servers.

## Repository Layout

- `skills/` - Production skill folders. Each skill folder should contain a required `SKILL.md` and optional bundled resources.
- `mcp/servers/` - MCP server projects that expose tools, resources, or prompts.
- `templates/skill/` - Starter structure for a new skill.
- `templates/mcp-server-typescript/` - Starter TypeScript stdio MCP server.
- `docs/` - Repository conventions, authoring notes, and publishing guidance.
- `scripts/validate-repo.mjs` - Lightweight structural validation for skills and MCP server folders.

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

Create a new MCP server:

```bash
cp -R templates/mcp-server-typescript mcp/servers/my-server
```

Then update the package name, server name, README, and tool/resource/prompt implementations.

## Public Repo Rules

- Do not commit secrets, private tokens, API keys, local credentials, or personal data.
- Keep skill `SKILL.md` files concise and procedural.
- Put detailed skill reference material in `references/`, reusable code in `scripts/`, and output assets in `assets/`.
- Prefer small, testable MCP tools with clear input schemas and predictable responses.
- Run `npm run validate` before publishing or opening a pull request.

## License

This repository is released under the MIT License. Change `LICENSE` if you prefer another publishing model.
