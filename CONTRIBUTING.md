# Contributing

Thanks for improving this skills and MCP collection.

## Naming

- Skill folders use lowercase hyphen-case, for example `pdf-workflow`.
- MCP server folders use lowercase hyphen-case, for example `github-issues-server`.
- Keep names action-oriented and specific.

## Skill Changes

- Each skill must have `SKILL.md`.
- `SKILL.md` frontmatter must contain only `name` and `description`.
- Keep `SKILL.md` focused on instructions an agent needs at runtime.
- Put large details in `references/`, deterministic helpers in `scripts/`, and reusable output files in `assets/`.
- Do not add user-facing README files inside individual skill folders.

## MCP Server Changes

- Each server under `mcp/servers/` should include a README and a runnable project manifest such as `package.json`, `pyproject.toml`, `go.mod`, or equivalent.
- Prefer small tools with clear schemas and narrow side effects.
- Write logs to stderr when using stdio transport.
- Never write non-protocol output to stdout in stdio servers.

## Validation

Run:

```bash
npm run validate
```

Fix all errors before opening a pull request.
