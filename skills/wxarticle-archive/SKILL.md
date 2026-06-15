---
name: wxarticle-archive
description: Archive user-provided public HTTPS webpages through a self-controlled Cloudflare Worker API with generic crawler, Markdown extraction, screenshot, and legacy WeChat article modes. Use when the user asks to crawl/archive webpages, convert URLs to local Markdown, capture public webpage screenshots, 抓取网页, 抓取微信文章, 保存公众号文章, archive WeChat articles, or download mp.weixin.qq.com URLs. Do not use for discovering articles by public-account name or date range.
---

# Web Archive Crawler

Use this skill to archive public HTTPS URLs that the user already has. Generic webpages use the v3 crawler endpoint by default. `https://mp.weixin.qq.com/s...` URLs are kept on the specialized WeChat article converter so older workflows still produce cleaner article metadata and image handling.

## Requirements

- Require user-provided public `https://` URLs or a text file containing one URL per line.
- Use `--kind auto` by default: WeChat article URLs go through the v2 article converter; other public webpages go through `POST /v3/crawl/inline`.
- Use `md-only` or `full` only for WeChat article URLs. Generic webpages are currently inline-only.
- For screenshots, require one public `https://` URL.
- Require `WEB_ARCHIVE_API_BASE` and `WEB_ARCHIVE_API_KEY`, unless the user passes `--api-base` and `--api-key`. Legacy `WXARTICLE_API_BASE` and `WXARTICLE_API_KEY` are accepted.
- Do not discover articles by公众号名称/date range.
- Do not bypass login, captcha, paywalls, private content, or access controls.

## Workflow

1. Resolve the skill directory and script path:

   ```bash
   python "<skill_dir>/scripts/wxarticle_archive.py" ...
   ```

2. Build arguments from the user's request:

   - Use `--input <path>` when the user provides a URL file.
   - Pass direct URLs as positional arguments when the user pasted URLs in chat.
   - Use `--output <dir>` when provided; otherwise let the script default to `./web_archive`.
   - Use `--kind auto` by default.
   - Use `--kind webpage` when every URL should use generic webpage extraction.
   - Use `--kind wechat` when every URL is a WeChat article and the user wants the legacy article converter.
   - Use `--mode inline` by default for privacy-first local archival.
   - Use `--mode md-only` when the user wants WeChat Markdown JSON stored in R2 but images downloaded locally.
   - Use `--mode full` when the user wants WeChat Markdown and images stored in R2.
   - Use `--cloud-images` only with `--mode full` when the user wants Markdown to keep authenticated cloud asset links.
   - Use `--no-image-download` when the user wants Markdown only.
   - Use `--page-strategy auto` by default for generic webpages; choose `browser-markdown`, `htmlrewriter`, or `rehype` only when requested.
   - Use `--render-strategy fallback` by default; use `--render-strategy always` only when the user explicitly wants Browser Run rendered extraction.
   - Use `--screenshot <url>` when the user asks for a webpage screenshot instead of archival.
   - Use `--screenshot-inline` when the screenshot should return directly without R2 storage.
   - Use `--api-base` / `--api-key` only when explicitly provided; otherwise rely on environment variables.

3. Run the script and stream or summarize its progress. It will:

   - In generic webpage inline mode, call `POST /v3/crawl/inline` once per URL and save Markdown locally.
   - In WeChat `inline` mode, call `POST /v2/archive/inline` once per URL and save each returned article locally.
   - In WeChat `md-only` or `full` mode, submit `POST /v2/jobs`, poll `GET /v2/jobs/<jobId>`, then fetch `GET /v2/jobs/<jobId>/results/<itemId>`.
   - With `--render-strategy fallback`, let the Worker try static fetch first, then Browser Run only if needed.
   - With `--screenshot`, call `POST /v2/screenshots/inline` or `POST /v2/screenshots`, then save the PNG locally.
   - Save Markdown files into the output directory.
   - Download images into `<output>/images` and rewrite Markdown image URLs to local relative paths unless `--no-image-download` or `--cloud-images` is used.

4. Report the final summary. Include:

   - Output directory.
   - Every saved `.md` path.
   - For screenshots, the saved `.png` path and metadata path when R2 storage was used.
   - Any failed URL and reason.

5. Remember the saved Markdown paths in conversation context so the user can ask follow-up questions like "summarize these pages" and the files can be read directly.

## Examples

```bash
python "<skill_dir>/scripts/wxarticle_archive.py" "https://example.com/article" --output "./archive"
python "<skill_dir>/scripts/wxarticle_archive.py" --input "C:/path/urls.txt" --kind auto --output "D:/archive"
python "<skill_dir>/scripts/wxarticle_archive.py" "https://example.com/article" --kind webpage --page-strategy browser-markdown
python "<skill_dir>/scripts/wxarticle_archive.py" "https://mp.weixin.qq.com/s/example" --kind wechat --render-strategy always
python "<skill_dir>/scripts/wxarticle_archive.py" --input urls.txt --kind wechat --mode full --cloud-images --api-base "https://web-archive-api.example.com" --api-key "$WEB_ARCHIVE_API_KEY"
python "<skill_dir>/scripts/wxarticle_archive.py" --screenshot "https://example.com/" --screenshot-inline --output "./captures"
```

## Failure Handling

- If API credentials are missing, explain that the user must set `WEB_ARCHIVE_API_BASE` and `WEB_ARCHIVE_API_KEY`, or pass `--api-base` and `--api-key`. Legacy `WXARTICLE_*` variables also work.
- If the API reports partial failure, keep successful Markdown files and report failed URLs.
- If image download fails, keep the original remote image URL in the Markdown and continue.
- If Browser Run is unavailable in the Cloudflare account, report the exact API error and retry with `--render-strategy never` only when static fetch is enough.
- If screenshot or generic page URL validation fails, explain that only public HTTPS URLs are accepted.
- If the job times out, report the job ID so the user can inspect the Worker logs or retry later.
