# web-archive-api

Cloudflare Worker API for generic public webpage crawling, Markdown/HTML extraction, screenshots, and legacy WeChat article archival.

The tracked folder is still `workers/wxarticle-archive-api/` so existing local ignored `wrangler.jsonc`, `.dev.vars`, and deployed resources do not need to move.

## Endpoints

Generic crawler:

- `POST /v3/crawl/inline` archives one public HTTPS webpage and returns Markdown, cleaned HTML when requested, links, images, metadata, and diagnostics.
- `POST /v3/pages/inline` is a compatibility alias for the same behavior.

Screenshots:

- `POST /v2/screenshots/inline` captures one public HTTPS URL and returns `image/png`.
- `POST /v2/screenshots` captures one public HTTPS URL, stores it in R2, and returns metadata.
- `GET /v2/screenshots/:screenshotId` returns a stored screenshot PNG.

Legacy WeChat article archival:

- `POST /v2/archive/inline` returns converted article data without intentionally writing article content to D1 or R2.
- `POST /v2/archive/rendered` forces Browser Run rendered extraction for one article URL.
- `POST /v2/jobs` creates an async `md-only` or `full` archive job for WeChat article URLs.
- `GET /v2/jobs/:jobId` returns job status and item states.
- `GET /v2/jobs/:jobId/results/:itemId` returns converted article JSON.
- `GET /v2/assets/:jobId/:itemId/:imageName` returns full-mode image assets.

The v1 job endpoints remain for compatibility.

## Local Setup

```powershell
npm install
Copy-Item .\wrangler.example.jsonc .\wrangler.jsonc
```

Edit the ignored `wrangler.jsonc` with your Cloudflare D1 database id, optional route, resource names, and Browser Run binding.

Create resources when starting from a fresh Cloudflare account:

```powershell
npx wrangler d1 create web_archive
npx wrangler r2 bucket create web-archive-results
npx wrangler queues create web-archive-jobs
npx wrangler secret put WEB_ARCHIVE_API_KEY
```

Existing deployments may keep `WXARTICLE_API_KEY`; the Worker accepts both secret names, preferring `WEB_ARCHIVE_API_KEY` when present.

Apply D1 schema and deploy:

```powershell
npx wrangler d1 migrations apply web_archive --remote
npm run deploy
```

Generic page strategy values:

- `auto`: static fetch first, Browser Run only if needed.
- `htmlrewriter`: Workers-native static extraction.
- `rehype`: AST sanitizer pipeline.
- `browser-markdown`: Browser Run Quick Actions.

`renderStrategy` values:

- `never`: static fetch only.
- `fallback`: static fetch first, Browser Run only if needed.
- `always`: Browser Run rendered extraction.

## Checks

```powershell
npm run typecheck
npm test
```
