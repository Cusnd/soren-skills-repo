# Skill Authoring

Skills are compact, procedural instruction bundles for agents.

## Required Shape

```text
skill-name/
  SKILL.md
  agents/openai.yaml
  scripts/
  references/
  assets/
```

Only `SKILL.md` is required. Other folders should exist only when useful.

## SKILL.md

Use YAML frontmatter with exactly:

```yaml
---
name: skill-name
description: What this skill does and when to use it.
---
```

The description is the trigger surface. Include the specific tasks, artifacts, tools, and situations that should activate the skill.

The body should be short, imperative, and focused on what an agent must do. Move long examples and domain reference material into `references/`.

## Bundled Resources

- `scripts/` for deterministic helpers that can be run or patched.
- `references/` for documentation the agent should load only when needed.
- `assets/` for templates, images, starter files, or other output resources.

## Authoring Principles

- Keep core instructions concise.
- Use progressive disclosure through references.
- Avoid duplicating the same facts in `SKILL.md` and references.
- Prefer scripts when correctness matters more than improvisation.
- Validate after every meaningful change.
