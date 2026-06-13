# Skills

Put production skills in this directory.

Each skill should use:

```text
skills/<skill-name>/
  SKILL.md
  agents/openai.yaml
  scripts/
  references/
  assets/
```

Rules:

- `SKILL.md` is required.
- The folder name must match the `name` field in `SKILL.md`.
- Use lowercase hyphen-case.
- Keep user-facing docs outside individual skill folders.
- Add optional resource folders only when they help the skill work.
