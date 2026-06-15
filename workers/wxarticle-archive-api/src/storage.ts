import {
  type AsyncStorageMode,
  DEFAULT_MAX_ATTEMPTS,
  type ArticleResult,
  type CloudImageResult,
  type CountRow,
  type ItemRow,
  type JobItemResponse,
  type JobResponse,
  type JobRow,
  type JobStatus,
  type QueueMessageBody,
  type RenderStrategy,
  type ScreenshotOptions,
  type ScreenshotResult
} from "./types";
import type { PageCacheInfo, PageResult } from "./webpage";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface CrawlSnapshotRow {
  snapshot_id: string;
  url_hash: string;
  url: string;
  result_key: string | null;
  content_hash: string | null;
  fetched_at: string;
  title: string | null;
  canonical_url: string | null;
  strategy_used: string | null;
  rendered: number;
  markdown_chars: number | null;
  html_chars: number | null;
  image_count: number | null;
  link_count: number | null;
  error: string | null;
}

export interface StoredCrawlSnapshot {
  page: PageResult;
  cache: Required<Pick<PageCacheInfo, "snapshotId" | "resultKey" | "storedAt">> &
    Pick<PageCacheInfo, "contentHash" | "ageSeconds">;
}

export interface StoredCrawlSnapshotMeta {
  snapshotId: string;
  resultKey: string;
  contentHash: string;
  storedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function deriveJobStatus(total: number, queued: number, processing: number, succeeded: number, failed: number): JobStatus {
  if (total > 0 && succeeded === total) {
    return "succeeded";
  }
  if (total > 0 && failed === total) {
    return "failed";
  }
  if (total > 0 && succeeded + failed === total) {
    return "partial_failed";
  }
  if (processing > 0 || succeeded > 0 || failed > 0) {
    return "processing";
  }
  return queued > 0 ? "queued" : "processing";
}

export function resultKey(jobId: string, itemId: string): string {
  return `jobs/${jobId}/${itemId}/article.json`;
}

export function screenshotKey(screenshotId: string): string {
  return `screenshots/${screenshotId}.png`;
}

export function crawlResultKey(urlHash: string, snapshotId: string): string {
  return `crawl/${urlHash}/${snapshotId}.json`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function withoutCache(page: PageResult): PageResult {
  const copy = { ...page };
  delete copy.cache;
  return copy;
}

async function crawlContentHash(page: PageResult): Promise<string> {
  return sha256Hex(
    JSON.stringify({
      title: page.title ?? "",
      description: page.description ?? "",
      canonicalUrl: page.canonicalUrl ?? "",
      markdown: page.markdown ?? "",
      html: page.html ?? "",
      images: page.images,
      links: page.links
    })
  );
}

function imageExtension(url: string, contentType: string | null): string {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  })();
  const match = /\.([a-z0-9]{1,8})$/iu.exec(path);
  if (match) {
    const ext = `.${match[1].toLowerCase()}`;
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".avif"].includes(ext)) {
      return ext;
    }
  }
  const type = (contentType ?? "").split(";", 1)[0].trim().toLowerCase();
  const byType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
    "image/avif": ".avif"
  };
  return byType[type] ?? ".jpg";
}

async function imageObjectName(url: string, contentType: string | null): Promise<string> {
  return `${await sha256Hex(url)}${imageExtension(url, contentType)}`;
}

function imageResultUrl(item: ItemRow, imageName: string): string {
  return `/v2/assets/${item.job_id}/${item.item_id}/${imageName}`;
}

export async function createJob(
  env: Env,
  urls: string[],
  maxAttempts: number,
  mode: AsyncStorageMode = "md-only",
  renderStrategy: RenderStrategy = "fallback"
): Promise<JobResponse> {
  const createdAt = nowIso();
  const jobId = crypto.randomUUID();
  const attempts = Math.max(1, Math.min(6, Math.trunc(maxAttempts || DEFAULT_MAX_ATTEMPTS)));
  const items = urls.map((url) => ({
    jobId,
    itemId: crypto.randomUUID(),
    url,
    maxAttempts: attempts
  }));

  const statements = [
    env.DB.prepare(
      "INSERT INTO jobs (job_id, mode, status, total, queued, processing, succeeded, failed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)"
    ).bind(jobId, mode, "queued", urls.length, urls.length, createdAt, createdAt),
    ...items.map((item) =>
      env.DB.prepare(
        "INSERT INTO items (job_id, item_id, url, status, attempts, max_attempts, error, result_key, result_kind, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, NULL, NULL, NULL, ?, ?)"
      ).bind(item.jobId, item.itemId, item.url, "queued", item.maxAttempts, createdAt, createdAt)
    )
  ];

  await env.DB.batch(statements);
  await env.ARTICLE_QUEUE.sendBatch(
    items.map((item) => ({
      body: {
        jobId: item.jobId,
        itemId: item.itemId,
        url: item.url,
        maxAttempts: item.maxAttempts,
        mode,
        renderStrategy
      } satisfies QueueMessageBody
    }))
  );

  return {
    jobId,
    status: "queued",
    counts: {
      total: urls.length,
      queued: urls.length,
      processing: 0,
      succeeded: 0,
      failed: 0
    },
    createdAt,
    updatedAt: createdAt,
    mode,
    items: items.map((item) => ({
      itemId: item.itemId,
      url: item.url,
      status: "queued",
      attempts: 0,
      maxAttempts: item.maxAttempts
    }))
  };
}

export async function getItem(env: Env, jobId: string, itemId: string): Promise<ItemRow | null> {
  return env.DB.prepare("SELECT * FROM items WHERE job_id = ? AND item_id = ?")
    .bind(jobId, itemId)
    .first<ItemRow>();
}

export async function getJob(env: Env, jobId: string, apiPrefix = "/v1"): Promise<JobResponse | null> {
  const job = await env.DB.prepare("SELECT * FROM jobs WHERE job_id = ?").bind(jobId).first<JobRow>();
  if (!job) {
    return null;
  }
  const items = await env.DB.prepare("SELECT * FROM items WHERE job_id = ? ORDER BY created_at, item_id")
    .bind(jobId)
    .all<ItemRow>();
  return jobResponse(job, items.results ?? [], apiPrefix);
}

export async function listSucceededItems(env: Env, jobId: string, apiPrefix = "/v1"): Promise<JobItemResponse[]> {
  const rows = await env.DB.prepare("SELECT * FROM items WHERE job_id = ? AND status = ? ORDER BY created_at, item_id")
    .bind(jobId, "succeeded")
    .all<ItemRow>();
  return (rows.results ?? []).map((item) => itemResponse(item, apiPrefix));
}

export async function getResult(env: Env, jobId: string, itemId: string): Promise<ArticleResult | null> {
  const item = await getItem(env, jobId, itemId);
  if (!item || item.status !== "succeeded" || !item.result_key) {
    return null;
  }
  const object = await env.RESULTS.get(item.result_key);
  if (!object) {
    return null;
  }
  return object.json<ArticleResult>();
}

export async function getLatestCrawlSnapshot(env: Env, url: string): Promise<StoredCrawlSnapshot | null> {
  const urlHash = await sha256Hex(url);
  const row = await env.DB.prepare(
    "SELECT * FROM crawl_snapshots WHERE url_hash = ? AND result_key IS NOT NULL ORDER BY fetched_at DESC LIMIT 1"
  )
    .bind(urlHash)
    .first<CrawlSnapshotRow>();
  if (!row?.result_key) {
    return null;
  }

  const object = await env.RESULTS.get(row.result_key);
  if (!object) {
    return null;
  }

  const page = await object.json<PageResult>();
  const fetchedAtMs = Date.parse(row.fetched_at);
  const ageSeconds = Number.isFinite(fetchedAtMs) ? Math.max(0, Math.floor((Date.now() - fetchedAtMs) / 1000)) : undefined;
  return {
    page: withoutCache(page),
    cache: {
      snapshotId: row.snapshot_id,
      resultKey: row.result_key,
      contentHash: row.content_hash ?? undefined,
      storedAt: row.fetched_at,
      ageSeconds
    }
  };
}

export function isStoredCrawlSnapshotFresh(snapshot: StoredCrawlSnapshot, ttlSeconds: number): boolean {
  return (snapshot.cache.ageSeconds ?? Number.POSITIVE_INFINITY) <= ttlSeconds;
}

export async function storeCrawlSnapshot(
  env: Env,
  page: PageResult,
  cacheTtlSeconds: number
): Promise<StoredCrawlSnapshotMeta> {
  const urlHash = await sha256Hex(page.url);
  const snapshotId = crypto.randomUUID();
  const key = crawlResultKey(urlHash, snapshotId);
  const contentHash = await crawlContentHash(page);
  const storedPage = withoutCache(page);
  const fetchedAt = page.fetchedAt || nowIso();

  await env.RESULTS.put(key, JSON.stringify(storedPage), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8"
    }
  });

  const statements = [
    env.DB.prepare(
      "INSERT INTO crawl_urls (url_hash, url, source, canonical_url, title, description, first_fetched_at, last_fetched_at, last_status, last_snapshot_id, last_result_key, last_content_hash, strategy_used, rendered, cache_ttl_seconds, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(url_hash) DO UPDATE SET url = excluded.url, source = excluded.source, canonical_url = excluded.canonical_url, title = excluded.title, description = excluded.description, last_fetched_at = excluded.last_fetched_at, last_status = excluded.last_status, last_snapshot_id = excluded.last_snapshot_id, last_result_key = excluded.last_result_key, last_content_hash = excluded.last_content_hash, strategy_used = excluded.strategy_used, rendered = excluded.rendered, cache_ttl_seconds = excluded.cache_ttl_seconds, error = NULL"
    ).bind(
      urlHash,
      page.url,
      page.source,
      page.canonicalUrl ?? null,
      page.title ?? null,
      page.description ?? null,
      fetchedAt,
      fetchedAt,
      "succeeded",
      snapshotId,
      key,
      contentHash,
      page.strategyUsed,
      page.rendered ? 1 : 0,
      cacheTtlSeconds
    ),
    env.DB.prepare(
      "INSERT INTO crawl_snapshots (snapshot_id, url_hash, url, result_key, content_hash, fetched_at, title, canonical_url, strategy_used, rendered, markdown_chars, html_chars, image_count, link_count, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)"
    ).bind(
      snapshotId,
      urlHash,
      page.url,
      key,
      contentHash,
      fetchedAt,
      page.title ?? null,
      page.canonicalUrl ?? null,
      page.strategyUsed,
      page.rendered ? 1 : 0,
      page.markdown?.length ?? null,
      page.html?.length ?? null,
      page.images.length,
      page.links.length
    )
  ];

  await env.DB.batch(statements);
  return {
    snapshotId,
    resultKey: key,
    contentHash,
    storedAt: fetchedAt
  };
}

export async function recordCrawlFailure(
  env: Env,
  url: string,
  error: string,
  cacheTtlSeconds: number
): Promise<void> {
  const urlHash = await sha256Hex(url);
  const fetchedAt = nowIso();
  const snapshotId = crypto.randomUUID();
  const source = new URL(url).hostname;
  const statements = [
    env.DB.prepare(
      "INSERT INTO crawl_urls (url_hash, url, source, canonical_url, title, description, first_fetched_at, last_fetched_at, last_status, last_snapshot_id, last_result_key, last_content_hash, strategy_used, rendered, cache_ttl_seconds, error) VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, NULL, NULL, NULL, NULL, 0, ?, ?) ON CONFLICT(url_hash) DO UPDATE SET url = excluded.url, source = excluded.source, last_fetched_at = excluded.last_fetched_at, last_status = excluded.last_status, cache_ttl_seconds = excluded.cache_ttl_seconds, error = excluded.error"
    ).bind(urlHash, url, source, fetchedAt, fetchedAt, "failed", cacheTtlSeconds, error),
    env.DB.prepare(
      "INSERT INTO crawl_snapshots (snapshot_id, url_hash, url, result_key, content_hash, fetched_at, title, canonical_url, strategy_used, rendered, markdown_chars, html_chars, image_count, link_count, error) VALUES (?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, ?)"
    ).bind(snapshotId, urlHash, url, fetchedAt, error)
  ];

  await env.DB.batch(statements);
}

export async function markItemProcessing(env: Env, item: ItemRow, attempts: number): Promise<void> {
  const updatedAt = nowIso();
  await env.DB.prepare(
    "UPDATE items SET status = ?, attempts = ?, error = NULL, updated_at = ? WHERE job_id = ? AND item_id = ?"
  )
    .bind("processing", attempts, updatedAt, item.job_id, item.item_id)
    .run();
}

export async function markItemQueuedForRetry(env: Env, item: ItemRow, error: string): Promise<void> {
  const updatedAt = nowIso();
  await env.DB.prepare("UPDATE items SET status = ?, error = ?, updated_at = ? WHERE job_id = ? AND item_id = ?")
    .bind("queued", error, updatedAt, item.job_id, item.item_id)
    .run();
}

export async function markItemSucceeded(
  env: Env,
  item: ItemRow,
  article: ArticleResult,
  mode: AsyncStorageMode = "md-only"
): Promise<void> {
  const key = resultKey(item.job_id, item.item_id);
  const updatedAt = nowIso();
  await env.RESULTS.put(key, JSON.stringify(article), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8"
    }
  });
  await env.DB.prepare(
    "UPDATE items SET status = ?, error = NULL, result_key = ?, result_kind = ?, updated_at = ? WHERE job_id = ? AND item_id = ?"
  )
    .bind("succeeded", key, mode, updatedAt, item.job_id, item.item_id)
    .run();
}

export async function storeImageAsset(
  env: Env,
  item: ItemRow,
  originalUrl: string,
  referer: string,
  fetcher: FetchLike = fetch
): Promise<CloudImageResult> {
  const createdAt = nowIso();
  try {
    const response = await fetcher(originalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "Referer": referer || "https://mp.weixin.qq.com/"
      }
    });
    if (!response.ok) {
      response.body?.cancel();
      throw new Error(`Image fetch failed with HTTP ${response.status}`);
    }
    const contentType = response.headers.get("Content-Type");
    const imageName = await imageObjectName(originalUrl, contentType);
    const key = `jobs/${item.job_id}/${item.item_id}/images/${imageName}`;
    await env.RESULTS.put(key, await response.arrayBuffer(), {
      httpMetadata: {
        contentType: contentType ?? "application/octet-stream"
      }
    });
    await env.DB.prepare(
      "INSERT OR REPLACE INTO assets (job_id, item_id, original_url, asset_key, content_type, error, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)"
    )
      .bind(item.job_id, item.item_id, originalUrl, key, contentType, createdAt)
      .run();
    return {
      originalUrl,
      key,
      url: imageResultUrl(item, imageName),
      contentType: contentType ?? undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await env.DB.prepare(
      "INSERT OR REPLACE INTO assets (job_id, item_id, original_url, asset_key, content_type, error, created_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)"
    )
      .bind(item.job_id, item.item_id, originalUrl, message, createdAt)
      .run();
    return {
      originalUrl,
      error: message
    };
  }
}

export async function getAsset(env: Env, jobId: string, itemId: string, imageName: string): Promise<R2ObjectBody | null> {
  if (!imageName || imageName.includes("/") || imageName.includes("\\") || imageName.includes("..")) {
    return null;
  }
  return env.RESULTS.get(`jobs/${jobId}/${itemId}/images/${imageName}`);
}

export async function storeScreenshot(
  env: Env,
  screenshotId: string,
  url: string,
  image: ArrayBuffer,
  options: ScreenshotOptions
): Promise<ScreenshotResult> {
  const createdAt = nowIso();
  const key = screenshotKey(screenshotId);
  const contentType = "image/png";
  await env.RESULTS.put(key, image, {
    httpMetadata: {
      contentType
    }
  });
  await env.DB.prepare(
    "INSERT OR REPLACE INTO screenshots (screenshot_id, url, r2_key, content_type, width, height, full_page, created_at, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)"
  )
    .bind(screenshotId, url, key, contentType, options.width, options.height, options.fullPage ? 1 : 0, createdAt)
    .run();
  return {
    screenshotId,
    url,
    assetUrl: `/v2/screenshots/${screenshotId}`,
    key,
    contentType,
    width: options.width,
    height: options.height,
    fullPage: options.fullPage,
    createdAt
  };
}

export async function recordScreenshotFailure(
  env: Env,
  screenshotId: string,
  url: string,
  options: ScreenshotOptions,
  error: string
): Promise<void> {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO screenshots (screenshot_id, url, r2_key, content_type, width, height, full_page, created_at, error) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?)"
  )
    .bind(screenshotId, url, options.width, options.height, options.fullPage ? 1 : 0, nowIso(), error)
    .run();
}

export async function getScreenshot(env: Env, screenshotId: string): Promise<R2ObjectBody | null> {
  if (!screenshotId || screenshotId.includes("/") || screenshotId.includes("\\") || screenshotId.includes("..")) {
    return null;
  }
  return env.RESULTS.get(screenshotKey(screenshotId));
}

export async function markItemFailed(env: Env, item: ItemRow, error: string): Promise<void> {
  const updatedAt = nowIso();
  await env.DB.prepare("UPDATE items SET status = ?, error = ?, updated_at = ? WHERE job_id = ? AND item_id = ?")
    .bind("failed", error, updatedAt, item.job_id, item.item_id)
    .run();
}

export async function refreshJobCounts(env: Env, jobId: string): Promise<void> {
  const rows = await env.DB.prepare("SELECT status, COUNT(*) AS count FROM items WHERE job_id = ? GROUP BY status")
    .bind(jobId)
    .all<CountRow>();
  const counts = {
    queued: 0,
    processing: 0,
    succeeded: 0,
    failed: 0
  };
  for (const row of rows.results ?? []) {
    counts[row.status] = Number(row.count);
  }
  const total = counts.queued + counts.processing + counts.succeeded + counts.failed;
  const status = deriveJobStatus(total, counts.queued, counts.processing, counts.succeeded, counts.failed);
  await env.DB.prepare(
    "UPDATE jobs SET status = ?, total = ?, queued = ?, processing = ?, succeeded = ?, failed = ?, updated_at = ? WHERE job_id = ?"
  )
    .bind(status, total, counts.queued, counts.processing, counts.succeeded, counts.failed, nowIso(), jobId)
    .run();
}

function itemResponse(item: ItemRow, apiPrefix = "/v1"): JobItemResponse {
  return {
    itemId: item.item_id,
    url: item.url,
    status: item.status,
    attempts: Number(item.attempts),
    maxAttempts: Number(item.max_attempts),
    error: item.error ?? undefined,
    resultKind: item.result_kind ?? undefined,
    resultUrl: item.result_key ? `${apiPrefix}/jobs/${item.job_id}/results/${item.item_id}` : undefined
  };
}

function jobResponse(job: JobRow, items: ItemRow[], apiPrefix = "/v1"): JobResponse {
  return {
    jobId: job.job_id,
    status: job.status,
    counts: {
      total: Number(job.total),
      queued: Number(job.queued),
      processing: Number(job.processing),
      succeeded: Number(job.succeeded),
      failed: Number(job.failed)
    },
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    mode: job.mode,
    items: items.map((item) => itemResponse(item, apiPrefix))
  };
}
