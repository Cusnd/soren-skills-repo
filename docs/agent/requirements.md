# Agent Requirements

- Keep existing WeChat archive and screenshot behavior working while adding generic webpage archival.
- Generic webpage archival must accept only public HTTPS URLs and must reject local/private/credentialed URLs.
- Default v3 webpage behavior is static-first with Browser Run fallback.
- Return both Markdown and cleaned HTML by default, plus metadata, images, links, and diagnostics.
- Compare Browser Run `/markdown`, Workers HTMLRewriter, and rehype/unified strategies for effect, cost, and performance.
