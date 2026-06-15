#!/usr/bin/env python3
"""Archive public webpages through a Web Archive Worker API."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


DEFAULT_OUTPUT_DIR = "web_archive"
TERMINAL_STATUSES = {"succeeded", "failed", "partial_failed"}
IMAGE_PATTERN = re.compile(r"https?://[^\s)\"']+")
INVALID_FILENAME_CHARS = re.compile(r'[/\\:*?"<>|]')
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".avif"}
IMAGE_DOWNLOAD_ATTEMPTS = 3
API_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
DEFAULT_API_BASE = os.environ.get("WEB_ARCHIVE_API_BASE") or os.environ.get("WXARTICLE_API_BASE")
DEFAULT_API_KEY = os.environ.get("WEB_ARCHIVE_API_KEY") or os.environ.get("WXARTICLE_API_KEY")


class ApiError(RuntimeError):
    pass


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Archive public webpages as local Markdown files."
    )
    parser.add_argument("urls", nargs="*", help="One or more public HTTPS URLs")
    parser.add_argument("--input", help="Text file containing one URL per line")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_DIR, help="Output directory")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--api-key", default=DEFAULT_API_KEY)
    parser.add_argument("--poll-interval", type=float, default=2.0)
    parser.add_argument("--timeout", type=float, default=600.0)
    parser.add_argument("--max-attempts", type=int, default=4)
    parser.add_argument("--image-workers", type=int, default=8)
    parser.add_argument("--kind", choices=("auto", "webpage", "wechat"), default="auto", help="Archive route for inline mode")
    parser.add_argument("--page-strategy", choices=("auto", "browser-markdown", "htmlrewriter", "rehype"), default="auto")
    parser.add_argument("--mode", choices=("inline", "md-only", "full"), default="inline")
    parser.add_argument("--render-strategy", choices=("never", "fallback", "always"), default="fallback")
    parser.add_argument("--cloud-images", action="store_true", help="Keep cloud image links in full mode instead of localizing them")
    parser.add_argument("--no-image-download", action="store_true", help="Save Markdown without downloading images")
    parser.add_argument("--screenshot", help="Capture a full-page screenshot for a public HTTPS URL instead of archiving articles")
    parser.add_argument("--screenshot-inline", action="store_true", help="Use the inline screenshot endpoint instead of storing in R2 first")
    parser.add_argument("--screenshot-width", type=int, default=1365)
    parser.add_argument("--screenshot-height", type=int, default=768)
    parser.add_argument("--screenshot-no-full-page", dest="screenshot_full_page", action="store_false", default=True)
    return parser.parse_args(argv)


def read_urls(input_path: str | None, inline_urls: list[str]) -> list[str]:
    urls: list[str] = []
    if input_path:
        with open(input_path, "r", encoding="utf-8") as fh:
            for raw_line in fh:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                urls.append(line)
    urls.extend(u.strip() for u in inline_urls if u.strip())
    deduped = list(dict.fromkeys(urls))
    return deduped


def is_wechat_article_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    return (
        parsed.scheme == "https"
        and not parsed.username
        and not parsed.password
        and parsed.netloc == "mp.weixin.qq.com"
        and (parsed.path == "/s" or parsed.path.startswith("/s/"))
    )


def resolve_source_kind(url: str, requested: str) -> str:
    if requested != "auto":
        return requested
    return "wechat" if is_wechat_article_url(url) else "webpage"


def safe_filename(name: str, fallback: str = "article") -> str:
    cleaned = INVALID_FILENAME_CHARS.sub("_", name)
    cleaned = re.sub(r"\s+", " ", cleaned).strip().strip(".")
    return cleaned or fallback


def url_folder_stem(url: str, fallback: str = "archive") -> str:
    parsed = urllib.parse.urlparse(url)
    parts = [parsed.netloc.replace(".", "_")] if parsed.netloc else []
    path = parsed.path.strip("/")
    if path:
        parts.extend(part for part in path.split("/") if part)
    if parsed.query:
        parts.append(hashlib.sha256(parsed.query.encode("utf-8")).hexdigest()[:12])
    raw = "_".join(parts).replace(".", "_")
    stem = safe_filename(raw, fallback)
    if len(stem) <= 120:
        return stem
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    return f"{stem[:107].rstrip('_')}_{digest}"


def unique_path(directory: Path, stem: str, suffix: str = ".md") -> Path:
    candidate = directory / f"{stem}{suffix}"
    index = 2
    while candidate.exists():
        candidate = directory / f"{stem}_{index}{suffix}"
        index += 1
    return candidate


def unique_directory(directory: Path, stem: str) -> Path:
    candidate = directory / stem
    index = 2
    while candidate.exists():
        candidate = directory / f"{stem}_{index}"
        index += 1
    candidate.mkdir(parents=True, exist_ok=False)
    return candidate


def image_extension(url: str, content_type: str | None = None) -> str:
    path = urllib.parse.urlparse(url).path
    ext = Path(path).suffix.lower()
    if ext in IMAGE_EXTS:
        return ext
    if content_type:
        guessed = mimetypes.guess_extension(content_type.split(";", 1)[0].strip())
        if guessed and guessed.lower() in IMAGE_EXTS:
            return guessed.lower()
    return ".jpg"


def hashed_image_name(url: str, content_type: str | None = None) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    return f"{digest}{image_extension(url, content_type)}"


def is_image_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path.lower()
    return (
        parsed.netloc.endswith("mmbiz.qpic.cn")
        or parsed.netloc.endswith("mmbiz.qlogo.cn")
        or parsed.netloc.endswith("mmbiz.qpic.com")
        or Path(path).suffix.lower() in IMAGE_EXTS
    )


def request_json(
    method: str,
    api_base: str,
    path: str,
    api_key: str,
    payload: dict[str, Any] | None = None,
    timeout: float = 60.0,
) -> dict[str, Any]:
    url = api_base.rstrip("/") + path
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
            "X-API-Key": api_key,
            "User-Agent": API_USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as err:
            raise ApiError(f"HTTP {exc.code}: {raw}") from err
        raise ApiError(data.get("error") or f"HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise ApiError(str(exc)) from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ApiError(f"API returned invalid JSON: {raw[:200]}") from exc
    if not isinstance(data, dict):
        raise ApiError("API returned a non-object JSON payload")
    return data


def request_binary(
    method: str,
    api_base: str,
    path: str,
    api_key: str,
    payload: dict[str, Any] | None = None,
    timeout: float = 120.0,
) -> tuple[bytes, str | None]:
    url = api_base.rstrip("/") + path
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Accept": "image/png,*/*",
            "Content-Type": "application/json; charset=utf-8",
            "X-API-Key": api_key,
            "User-Agent": API_USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read(), resp.headers.get("Content-Type")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as err:
            raise ApiError(f"HTTP {exc.code}: {raw}") from err
        raise ApiError(data.get("error") or f"HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise ApiError(str(exc)) from exc


def archive_inline(api_base: str, api_key: str, url: str, render_strategy: str) -> dict[str, Any]:
    return request_json(
        "POST",
        api_base,
        "/v2/archive/inline",
        api_key,
        {"url": url, "options": {"downloadImages": False, "renderStrategy": render_strategy}},
    )


def archive_page_inline(api_base: str, api_key: str, url: str, render_strategy: str, page_strategy: str) -> dict[str, Any]:
    return request_json(
        "POST",
        api_base,
        "/v3/crawl/inline",
        api_key,
        {
            "url": url,
            "options": {
                "strategy": page_strategy,
                "output": "markdown",
                "renderStrategy": render_strategy,
                "includeDiagnostics": True,
            },
        },
        timeout=180,
    )


def submit_job(api_base: str, api_key: str, urls: list[str], max_attempts: int, mode: str, render_strategy: str) -> str:
    data = request_json(
        "POST",
        api_base,
        "/v2/jobs",
        api_key,
        {"urls": urls, "mode": mode, "options": {"maxAttempts": max_attempts, "renderStrategy": render_strategy}},
    )
    job_id = data.get("jobId")
    if not isinstance(job_id, str) or not job_id:
        raise ApiError("API response did not include jobId")
    return job_id


def poll_job(
    api_base: str,
    api_key: str,
    job_id: str,
    poll_interval: float,
    timeout: float,
) -> dict[str, Any]:
    started = time.monotonic()
    last_status = None
    while True:
        data = request_json("GET", api_base, f"/v2/jobs/{job_id}", api_key)
        status = str(data.get("status", "unknown"))
        counts = data.get("counts", {})
        if status != last_status:
            print(f"JOB:{job_id} STATUS:{status} COUNTS:{json.dumps(counts, ensure_ascii=False)}")
            last_status = status
        if status in TERMINAL_STATUSES:
            return data
        if time.monotonic() - started > timeout:
            raise ApiError(f"Timed out waiting for job {job_id}")
        time.sleep(max(0.2, poll_interval))


def fetch_result(api_base: str, api_key: str, job_id: str, item_id: str) -> dict[str, Any]:
    return request_json("GET", api_base, f"/v2/jobs/{job_id}/results/{item_id}", api_key)


def download_image(
    url: str,
    replace_url: str,
    images_dir: Path,
    referer: str | None,
    api_key: str | None = None,
) -> tuple[str, str | None]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
        ),
        "Referer": referer or "https://mp.weixin.qq.com/",
    }
    if api_key:
        headers["X-API-Key"] = api_key
    req = urllib.request.Request(
        url,
        headers=headers,
    )
    for attempt in range(1, IMAGE_DOWNLOAD_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                content_type = resp.headers.get("Content-Type")
                local_name = hashed_image_name(url, content_type)
                dest = images_dir / local_name
                data = resp.read()
            if not data:
                return url, None
            if not dest.exists():
                with open(dest, "wb") as fh:
                    fh.write(data)
            return replace_url, local_name
        except Exception:
            if attempt < IMAGE_DOWNLOAD_ATTEMPTS:
                time.sleep(0.25 * attempt)
    return replace_url, None


def cloud_image_map(result: dict[str, Any], api_base: str) -> dict[str, str]:
    images = result.get("cloudImages") or []
    mapped: dict[str, str] = {}
    if not isinstance(images, list):
        return mapped
    for item in images:
        if not isinstance(item, dict):
            continue
        original = item.get("originalUrl")
        cloud_url = item.get("url")
        if isinstance(original, str) and isinstance(cloud_url, str) and cloud_url:
            mapped[original] = urllib.parse.urljoin(api_base.rstrip("/") + "/", cloud_url.lstrip("/"))
    return mapped


def localize_images(
    markdown: str,
    image_urls: list[str],
    images_dir: Path,
    referer: str | None,
    workers: int,
    api_key: str | None = None,
    cloud_sources: dict[str, str] | None = None,
) -> str:
    discovered = [u for u in IMAGE_PATTERN.findall(markdown) if is_image_url(u)]
    urls = list(dict.fromkeys(image_urls + discovered))
    if not urls:
        return markdown

    pairs = [(cloud_sources.get(u, u) if cloud_sources else u, u) for u in urls]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        futures = [
            executor.submit(download_image, download_url, replace_url, images_dir, referer, api_key if download_url != replace_url else None)
            for download_url, replace_url in pairs
        ]
        for future in concurrent.futures.as_completed(futures):
            original, local_name = future.result()
            if local_name:
                markdown = markdown.replace(original, f"./images/{local_name}")
    return markdown


def save_result(
    result: dict[str, Any],
    output_dir: Path,
    image_workers: int,
    api_base: str,
    api_key: str,
    download_images: bool,
    keep_cloud_images: bool,
) -> Path:
    url = str(result.get("url") or "")
    item_dir = unique_directory(output_dir, url_folder_stem(url))
    markdown = str(result.get("markdown") or "")
    raw_images = result.get("images") or []
    images = [str(u) for u in raw_images if isinstance(u, str)]
    cloud_sources = cloud_image_map(result, api_base)

    if keep_cloud_images and cloud_sources:
        for original, cloud_url in cloud_sources.items():
            markdown = markdown.replace(original, cloud_url)
    elif download_images:
        images_dir = item_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)
        markdown = localize_images(markdown, images, images_dir, url, image_workers, api_key, cloud_sources)

    path = item_dir / "index.md"
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(markdown.rstrip() + "\n")
    return path


def collect_success_items(job: dict[str, Any]) -> list[dict[str, str]]:
    items = job.get("items", [])
    if not isinstance(items, list):
        return []
    successes: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("status") == "succeeded" and isinstance(item.get("itemId"), str):
            successes.append({"itemId": item["itemId"], "url": str(item.get("url", ""))})
    return successes


def collect_failures(job: dict[str, Any]) -> list[tuple[str, str]]:
    items = job.get("items", [])
    failures: list[tuple[str, str]] = []
    if not isinstance(items, list):
        return failures
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("status") == "failed":
            failures.append((str(item.get("url", "")), str(item.get("error", "unknown error"))))
    return failures


def screenshot_options(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "width": args.screenshot_width,
        "height": args.screenshot_height,
        "fullPage": args.screenshot_full_page,
    }


def screenshot_path(output_dir: Path, url: str) -> Path:
    parsed = urllib.parse.urlparse(url)
    stem = safe_filename(f"{parsed.netloc}{parsed.path}".strip("/") or "screenshot", "screenshot")
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    screenshots_dir = output_dir / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)
    return unique_path(screenshots_dir, f"{stem}-{digest}", ".png")


def capture_screenshot_inline(api_base: str, api_key: str, url: str, options: dict[str, Any]) -> bytes:
    image, _content_type = request_binary(
        "POST",
        api_base,
        "/v2/screenshots/inline",
        api_key,
        {"url": url, "options": options},
        timeout=180,
    )
    return image


def capture_screenshot_stored(api_base: str, api_key: str, url: str, options: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
    result = request_json(
        "POST",
        api_base,
        "/v2/screenshots",
        api_key,
        {"url": url, "options": options},
        timeout=180,
    )
    asset_url = result.get("assetUrl")
    if not isinstance(asset_url, str) or not asset_url:
        raise ApiError("screenshot response did not include assetUrl")
    image, _content_type = request_binary("GET", api_base, asset_url, api_key, timeout=120)
    return image, result


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if not args.api_base:
        print("ERROR: missing API base. Set WEB_ARCHIVE_API_BASE or WXARTICLE_API_BASE, or pass --api-base.", file=sys.stderr)
        return 2
    if not args.api_key:
        print("ERROR: missing API key. Set WEB_ARCHIVE_API_KEY or WXARTICLE_API_KEY, or pass --api-key.", file=sys.stderr)
        return 2

    output_dir = Path(args.output).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.screenshot:
        options = screenshot_options(args)
        print(f"[1/2] Capturing screenshot for {args.screenshot}")
        if args.screenshot_inline:
            image = capture_screenshot_inline(args.api_base, args.api_key, args.screenshot, options)
            metadata: dict[str, Any] | None = None
        else:
            image, metadata = capture_screenshot_stored(args.api_base, args.api_key, args.screenshot, options)
        path = screenshot_path(output_dir, args.screenshot)
        with open(path, "wb") as fh:
            fh.write(image)
        if metadata:
            meta_path = path.with_suffix(".json")
            with open(meta_path, "w", encoding="utf-8", newline="\n") as fh:
                json.dump(metadata, fh, ensure_ascii=False, indent=2)
                fh.write("\n")
            print(f"META:{meta_path}")
        print(f"[2/2] SAVED:{path}")
        return 0

    urls = read_urls(args.input, args.urls)
    if not urls:
        print("ERROR: no URLs provided. Pass URLs or use --input urls.txt.", file=sys.stderr)
        return 2

    if args.mode != "inline" and any(not is_wechat_article_url(url) for url in urls):
        print("ERROR: md-only and full modes currently support WeChat article URLs only; use --mode inline for generic webpages.", file=sys.stderr)
        return 2

    saved: list[Path] = []
    failures: list[tuple[str, str]] = []

    if args.mode == "inline":
        print(f"[1/3] Archiving {len(urls)} URL(s) inline via {args.api_base.rstrip('/')}")
        for url in urls:
            try:
                source_kind = resolve_source_kind(url, args.kind)
                if source_kind == "wechat":
                    result = archive_inline(args.api_base, args.api_key, url, args.render_strategy)
                else:
                    result = archive_page_inline(args.api_base, args.api_key, url, args.render_strategy, args.page_strategy)
                print(f"[2/3] Saving {result.get('title') or url}")
                path = save_result(
                    result,
                    output_dir,
                    max(1, args.image_workers),
                    args.api_base,
                    args.api_key,
                    not args.no_image_download,
                    False,
                )
                saved.append(path)
                print(f"SAVED:{path}")
            except Exception as exc:
                failures.append((url, str(exc)))
        print("[3/3] Summary")
    else:
        print(f"[1/5] Submitting {len(urls)} URL(s) to {args.api_base.rstrip()} in {args.mode} mode")
        job_id = submit_job(args.api_base, args.api_key, urls, max(1, args.max_attempts), args.mode, args.render_strategy)

        print(f"[2/5] Waiting for job {job_id}")
        job = poll_job(args.api_base, args.api_key, job_id, args.poll_interval, args.timeout)

        print("[3/5] Fetching converted results")
        for item in collect_success_items(job):
            result = fetch_result(args.api_base, args.api_key, job_id, item["itemId"])
            print(f"[4/5] Saving {result.get('title') or item['url']}")
            path = save_result(
                result,
                output_dir,
                max(1, args.image_workers),
                args.api_base,
                args.api_key,
                not args.no_image_download,
                args.cloud_images,
            )
            saved.append(path)
            print(f"SAVED:{path}")
        failures.extend(collect_failures(job))
        print("[5/5] Summary")

    print(f"Saved {len(saved)} item(s) to {output_dir}")
    for url, reason in failures:
        print(f"FAILED:{url} | {reason}")
    return 0 if saved or not failures else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
