# Repository Conventions

## Skills

Production skills live in `skills/<skill-name>/`.

Required:

- `SKILL.md`

Recommended:

- `agents/openai.yaml`

Optional:

- `scripts/`
- `references/`
- `assets/`

Skill folders must use lowercase hyphen-case and match the `name` field in `SKILL.md`.

## MCP Servers

MCP servers live in `mcp/servers/<server-name>/`.

Each server should include:

- a README with purpose, tools, resources, prompts, and client setup
- a runnable project manifest, such as `package.json` or `pyproject.toml`
- tests or smoke checks for core tools
- an example client configuration when useful

## Templates

Templates live in `templates/` and are not validated as production skills or servers. Keep templates generic and free of secrets.

## Versioning

Use semantic versions for reusable MCP server packages. For skills, document meaningful changes in pull request descriptions unless a skill needs its own release notes.

## Publishing Checklist

- `npm run validate` passes
- no secrets or local-only paths are committed
- README explains what changed
- MCP servers include a clear runtime and transport story
- skills include concise trigger descriptions in frontmatter
