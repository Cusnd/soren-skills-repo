# WxArticle Archive

`wxarticle-archive` is a Codex skill plus Cloudflare Worker API for archiving user-provided public WeChat article URLs into Markdown.
It supports static article fetch, Cloudflare Browser Run rendered fallback, public HTTPS full-page screenshots, and v3 generic public webpage archival.

## Repository Paths

- Skill: `skills/wxarticle-archive/`
- Local client: `skills/wxarticle-archive/scripts/wxarticle_archive.py`
- Client tests: `skills/wxarticle-archive/tests/`
- Worker API: `workers/wxarticle-archive-api/`
- Worker migrations: `workers/wxarticle-archive-api/migrations/`

## Storage Modes

- `inline` is the default privacy-first path. The Worker returns article JSON directly and does not intentionally write article Markdown or image files to D1/R2.
- `md-only` submits an async job. D1 stores job/item state and R2 stores article JSON; images remain original URLs for local download.
- `full` submits an async job. D1 stores job/item state, R2 stores article JSON, and the Worker also stores downloaded images in R2 when available.

Cloudflare platform logs and request metadata can still exist outside application storage.

## Render And Screenshot Modes

- `renderStrategy: "never"` uses only static `fetch`.
- `renderStrategy: "fallback"` is the default: static fetch first, then Browser Run only when fetch fails or the extracted body is suspiciously short.
- `renderStrategy: "always"` forces Browser Run and is also exposed as `POST /v2/archive/rendered`.
- Screenshot endpoints accept one public `https://` URL, reject local/private hosts, and do not send user cookies.

## Generic Webpage Archive v3

`POST /v3/pages/inline` archives one public HTTPS webpage and returns Markdown, cleaned HTML, links, images, metadata, strategy diagnostics, and Browser Run usage when applicable.

Request defaults:

```json
{
  "url": "https://example.com/article",
  "options": {
    "strategy": "auto",
    "output": "both",
    "renderStrategy": "fallback",
    "includeDiagnostics": true
  }
}
```

Strategies:

- `auto` is static-first: use the HTMLRewriter cleaner, then fall back to Browser Run `/markdown` when static output is too short or static fetch fails.
- `browser-markdown` calls Browser Run `markdown` and `content` Quick Actions through the Worker binding.
- `htmlrewriter` uses Workers-native HTMLRewriter plus the shared allowlist cleaner.
- `rehype` uses `rehype-parse`, `rehype-sanitize`, and `rehype-stringify`, then the shared allowlist cleaner.

All webpage modes reuse the same public HTTPS validation used for screenshots, including local/private host blocking and credential rejection. The cleaned HTML allowlist removes scripts, styles, forms, iframes, embedded objects, SVG/MathML, event attributes, inline styles, and unsafe URL protocols.

## Local Skill Usage

Use environment variables or explicit flags:

```powershell
$env:WXARTICLE_API_BASE = "https://wxarticle-api.example.com"
$env:WXARTICLE_API_KEY = "replace-with-your-api-key"
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py --input .\urls.txt --output .\articles --mode inline
```

Direct URL examples:

```powershell
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py "https://mp.weixin.qq.com/s/example" --output .\articles --mode md-only
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py --input .\urls.txt --output .\articles --mode full
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py "https://mp.weixin.qq.com/s/example" --render-strategy always
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py --screenshot "https://example.com/" --screenshot-inline --output .\captures
```

Image flags:

- `--no-image-download` saves Markdown only.
- `--cloud-images` keeps authenticated cloud asset links in `full` mode instead of rewriting to local image files.
- `--render-strategy never|fallback|always` controls static versus Browser Run article extraction.
- `--screenshot <url>` captures one public HTTPS page instead of archiving articles.
- `--screenshot-inline` returns screenshot bytes directly; without it, the Worker stores the PNG in R2 and the client downloads a local copy plus metadata.

## Worker API v2

- `POST /v2/archive/inline`
- `POST /v2/archive/rendered`
- `POST /v2/jobs`
- `GET /v2/jobs/:jobId`
- `GET /v2/jobs/:jobId/results/:itemId`
- `GET /v2/assets/:jobId/:itemId/:imageName`
- `POST /v2/screenshots/inline`
- `POST /v2/screenshots`
- `GET /v2/screenshots/:screenshotId`
- `POST /v3/pages/inline`

## Generic Webpage Benchmark

Remote comparison is available after deploying the Worker and setting local API credentials:

```powershell
cd .\workers\wxarticle-archive-api
$env:WXARTICLE_API_BASE = "https://wxarticle-api.example.com"
$env:WXARTICLE_API_KEY = "replace-with-your-api-key"
npm run benchmark:webpages
```

The benchmark runs the same URL list against `auto`, `browser-markdown`, `htmlrewriter`, and `rehype`, then reports elapsed time, output size, success rate, rendered status, and `diagnostics.browserMsUsed`.

## Worker Deployment

Keep real Cloudflare configuration outside Git:

```powershell
cd .\workers\wxarticle-archive-api
npm install
Copy-Item .\wrangler.example.jsonc .\wrangler.jsonc
```

Edit the ignored `wrangler.jsonc`, then run:

```powershell
npx wrangler d1 migrations apply wxarticle_archive --remote
npx wrangler secret put WXARTICLE_API_KEY
npm run deploy
```

The Worker uses D1, R2, Queues, and a Browser Run `BROWSER` binding. Do not commit `.dev.vars`, real `wrangler.jsonc`, generated bundles, account IDs, production database IDs, custom domains, or API keys.
