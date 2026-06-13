---
name: wxarticle-archive
description: Archive user-provided public WeChat article URLs through a self-controlled Cloudflare Worker API with inline, md-only, or full cloud-storage modes; save each article as local Markdown and optionally download images into a shared images folder. Use when the user asks to抓取微信文章, 保存公众号文章, archive WeChat articles, download mp.weixin.qq.com URLs, or convert provided WeChat article URLs or a urls.txt file into local Markdown. Do not use for discovering articles by public-account name or date range.
---

# WxArticle Archive

Use this skill to archive public WeChat article URLs that the user already has. The default `inline` mode returns converted data directly to the local script without storing article data in D1/R2. Use `md-only` or `full` only when the user wants cloud-side archival.

## Requirements

- Require only user-provided `https://mp.weixin.qq.com/s...` article URLs or a text file containing one URL per line.
- Require `WXARTICLE_API_BASE` and `WXARTICLE_API_KEY`, unless the user passes `--api-base` and `--api-key`.
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
   - Use `--output <dir>` when provided; otherwise let the script default to `./wxarticle_archive`.
   - Use `--mode inline` by default for privacy-first local archival.
   - Use `--mode md-only` when the user wants Markdown JSON stored in R2 but images downloaded locally.
   - Use `--mode full` when the user wants Markdown and images stored in R2.
   - Use `--cloud-images` only with `--mode full` when the user wants Markdown to keep authenticated cloud asset links.
   - Use `--no-image-download` when the user wants Markdown only.
   - Use `--api-base` / `--api-key` only when explicitly provided; otherwise rely on environment variables.

3. Run the script and stream or summarize its progress. It will:

   - In `inline` mode, call `POST /v2/archive/inline` once per URL and save each returned article locally.
   - In `md-only` or `full` mode, submit `POST /v2/jobs`, poll `GET /v2/jobs/<jobId>`, then fetch `GET /v2/jobs/<jobId>/results/<itemId>`.
   - Save Markdown files into the output directory.
   - Download images into `<output>/images` and rewrite Markdown image URLs to local relative paths unless `--no-image-download` or `--cloud-images` is used.

4. Report the final summary. Include:

   - Output directory.
   - Every saved `.md` path.
   - Any failed URL and reason.

5. Remember the saved Markdown paths in conversation context so the user can ask follow-up questions like "summarize these articles" and the files can be read directly.

## Examples

```bash
python "<skill_dir>/scripts/wxarticle_archive.py" --input "C:/path/urls.txt" --output "D:/articles" --mode inline
python "<skill_dir>/scripts/wxarticle_archive.py" "https://mp.weixin.qq.com/s/example" --output "./articles" --mode md-only
python "<skill_dir>/scripts/wxarticle_archive.py" --input urls.txt --mode full --cloud-images --api-base "https://wxarticle-api.example.com" --api-key "$WXARTICLE_API_KEY"
```

## Failure Handling

- If API credentials are missing, explain that the user must set `WXARTICLE_API_BASE` and `WXARTICLE_API_KEY`, or pass `--api-base` and `--api-key`.
- If the API reports partial failure, keep successful Markdown files and report failed URLs.
- If image download fails, keep the original remote image URL in the Markdown and continue.
- If the job times out, report the job ID so the user can inspect the Worker logs or retry later.
