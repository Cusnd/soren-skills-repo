# WxArticle Archive

`wxarticle-archive` is a Codex skill plus Cloudflare Worker API for archiving user-provided public WeChat article URLs into Markdown.

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
```

Image flags:

- `--no-image-download` saves Markdown only.
- `--cloud-images` keeps authenticated cloud asset links in `full` mode instead of rewriting to local image files.

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

Do not commit `.dev.vars`, real `wrangler.jsonc`, generated bundles, account IDs, production database IDs, or API keys.
