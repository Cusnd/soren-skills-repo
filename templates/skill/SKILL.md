---
name: example-skill
description: Replace this with a concise description of what the skill does and the exact situations when Codex should use it.
---

# Example Skill

## Workflow

1. Identify the user's concrete task and relevant artifacts.
2. Load only the bundled references needed for that task.
3. Use scripts when deterministic output is required.
4. Validate the result before responding.

## Resources

- Read `references/` files only when the task needs the extra context.
- Run or patch `scripts/` helpers instead of rewriting repeated logic.
- Use `assets/` files as starting points for generated output.
