# Agent Decisions

- 2026-06-15: Implement v3 generic webpage archival as a new endpoint instead of widening the WeChat-specific v2 archive contract.
- 2026-06-15: Use HTMLRewriter as the static-first default because it has no production dependency and runs natively in Workers.
- 2026-06-15: Keep Browser Run `/markdown` as fallback and explicit strategy so JS-heavy pages can be handled while browser time remains measurable.
- 2026-06-15: Add rehype/unified as an explicit strategy for AST-based sanitizer comparison, not as the default path.
- 2026-06-15: Use a shared allowlist cleaner after each HTML-producing path to keep cleaned HTML policy consistent.
