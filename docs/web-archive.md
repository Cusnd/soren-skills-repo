# Web Archive Crawler

Web Archive Crawler is a Codex skill plus Cloudflare Worker API for archiving user-provided public HTTPS pages into local Markdown. It supports static-first generic webpage extraction, Browser Run fallback for rendered pages, screenshots, and a legacy WeChat article mode for `mp.weixin.qq.com/s...` URLs.

## Repository Paths

- Skill: `skills/wxarticle-archive/`
- Local client: `skills/wxarticle-archive/scripts/wxarticle_archive.py`
- Client tests: `skills/wxarticle-archive/tests/`
- Worker API: `workers/wxarticle-archive-api/`
- Worker migrations: `workers/wxarticle-archive-api/migrations/`

The folder names are retained for compatibility with existing local ignored config and deployed resources. New user-facing docs, examples, environment variables, and Worker examples use the Web Archive naming.

## Generic Webpage Archive

Preferred endpoint:

- `POST /v3/crawl/inline`

Compatibility alias:

- `POST /v3/pages/inline`

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

The generic crawler accepts only public HTTPS URLs. It rejects localhost, private IPs, credentialed URLs, and unsupported protocols. Cleaned HTML removes scripts, styles, forms, iframes, embedded objects, SVG/MathML, event attributes, inline styles, and unsafe URL protocols.

Challenge pages such as Cloudflare `Just a moment...`, human verification, CAPTCHA, and access-security interstitials are treated as failed extraction results instead of archived content. In `auto` mode, a static challenge page triggers Browser Run fallback; if Browser Run still returns a challenge page, the API returns HTTP 422.

## WeChat Article Compatibility

The v2 endpoints remain for existing WeChat article archival workflows:

- `POST /v2/archive/inline`
- `POST /v2/archive/rendered`
- `POST /v2/jobs`
- `GET /v2/jobs/:jobId`
- `GET /v2/jobs/:jobId/results/:itemId`
- `GET /v2/assets/:jobId/:itemId/:imageName`

Storage modes:

- `inline` is privacy-first. The Worker returns article JSON directly and does not intentionally write article Markdown or image files to D1/R2.
- `md-only` submits an async job. D1 stores job/item state and R2 stores article JSON; images remain original URLs for local download.
- `full` submits an async job. D1 stores job/item state, R2 stores article JSON, and the Worker also stores downloaded images in R2 when available.

`renderStrategy` values are `never`, `fallback`, and `always`. The default remains `fallback`.

## Screenshots

- `POST /v2/screenshots/inline`
- `POST /v2/screenshots`
- `GET /v2/screenshots/:screenshotId`

Screenshot endpoints accept one public HTTPS URL, reject local/private hosts, and do not send user cookies.

## Local Skill Usage

Use the new generic environment variables, or the legacy `WXARTICLE_*` aliases:

```powershell
$env:WEB_ARCHIVE_API_BASE = "https://web-archive-api.example.com"
$env:WEB_ARCHIVE_API_KEY = "replace-with-your-api-key"
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py "https://example.com/article" --output .\archive
```

Examples:

```powershell
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py --input .\urls.txt --kind auto --output .\archive
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py "https://example.com/article" --kind webpage --page-strategy auto
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py "https://mp.weixin.qq.com/s/example" --kind wechat --render-strategy fallback
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py --input .\wechat-urls.txt --kind wechat --mode full --cloud-images
python .\skills\wxarticle-archive\scripts\wxarticle_archive.py --screenshot "https://example.com/" --screenshot-inline --output .\captures
```

Image flags:

- `--no-image-download` saves Markdown only.
- `--cloud-images` keeps authenticated cloud asset links in WeChat `full` mode instead of rewriting to local image files.
- `--render-strategy never|fallback|always` controls static versus Browser Run extraction.
- `--page-strategy auto|browser-markdown|htmlrewriter|rehype` controls generic page extraction.
- `--screenshot <url>` captures one public HTTPS page instead of archiving pages.
- `--screenshot-inline` returns screenshot bytes directly; without it, the Worker stores the PNG in R2 and the client downloads a local copy plus metadata.

## Benchmark

Remote comparison is available after deploying the Worker and setting local API credentials:

```powershell
cd .\workers\wxarticle-archive-api
$env:WEB_ARCHIVE_API_BASE = "https://web-archive-api.example.com"
$env:WEB_ARCHIVE_API_KEY = "replace-with-your-api-key"
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
npx wrangler d1 migrations apply web_archive --remote
npx wrangler secret put WEB_ARCHIVE_API_KEY
npm run deploy
```

The Worker still accepts the legacy `WXARTICLE_API_KEY` binding for existing deployments. New deployments should use `WEB_ARCHIVE_API_KEY`.

The Worker uses D1, R2, Queues, and a Browser Run `BROWSER` binding. Do not commit `.dev.vars`, real `wrangler.jsonc`, generated bundles, account IDs, production database IDs, custom domains, or API keys.
