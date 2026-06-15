# Agent Requirements

- Present the project as a generic public-web archive/crawler while keeping existing WeChat archive and screenshot behavior working.
- Generic webpage archival must accept only public HTTPS URLs and must reject local/private/credentialed URLs.
- Default v3 crawler behavior is static-first with Browser Run fallback.
- Return both Markdown and cleaned HTML by default, plus metadata, images, links, and diagnostics.
- Compare Browser Run `/markdown`, Workers HTMLRewriter, and rehype/unified strategies for effect, cost, and performance.
- Prefer `WEB_ARCHIVE_API_BASE` and `WEB_ARCHIVE_API_KEY` for new clients while keeping legacy `WXARTICLE_*` aliases.
