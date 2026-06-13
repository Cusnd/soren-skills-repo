# wxarticle-archive-api

Cloudflare Worker API used by the `wxarticle-archive` skill. It converts user-provided public WeChat article URLs into Markdown through v2 inline, md-only, or full storage modes.

## Endpoints

- `POST /v2/archive/inline` returns converted article data without intentionally writing article content to D1 or R2.
- `POST /v2/jobs` creates an async `md-only` or `full` archive job.
- `GET /v2/jobs/:jobId` returns job status and item states.
- `GET /v2/jobs/:jobId/results/:itemId` returns converted article JSON.
- `GET /v2/assets/:jobId/:itemId/:imageName` returns full-mode image assets.

The v1 job endpoints remain for compatibility.

## Local Setup

```powershell
npm install
Copy-Item .\wrangler.example.jsonc .\wrangler.jsonc
```

Edit the ignored `wrangler.jsonc` with your Cloudflare D1 database id, optional route, and resource names.

Create resources when starting from a fresh Cloudflare account:

```powershell
npx wrangler d1 create wxarticle_archive
npx wrangler r2 bucket create wxarticle-archive-results
npx wrangler queues create wxarticle-archive-jobs
npx wrangler secret put WXARTICLE_API_KEY
```

Apply D1 schema and deploy:

```powershell
npx wrangler d1 migrations apply wxarticle_archive --remote
npm run deploy
```

## Checks

```powershell
npm run typecheck
npm test
```
