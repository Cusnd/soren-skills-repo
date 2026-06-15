import { verifyApiKey } from "./auth";
import { fetchAndConvertArticleWithStrategy, isAllowedWeChatArticleUrl } from "./converter";
import { captureScreenshot, parsePublicHttpsUrl, parseScreenshotOptions, screenshotImageResponse } from "./screenshot";
import {
  createJob,
  getAsset,
  getJob,
  getLatestCrawlSnapshot,
  getResult,
  getScreenshot,
  isStoredCrawlSnapshotFresh,
  listSucceededItems,
  recordCrawlFailure,
  recordScreenshotFailure,
  storeCrawlSnapshot,
  storeScreenshot
} from "./storage";
import {
  DEFAULT_MAX_ATTEMPTS,
  MAX_REQUEST_BYTES,
  MAX_URLS_PER_JOB,
  type AsyncStorageMode,
  type RenderStrategy
} from "./types";
import { fetchAndConvertPageWithStrategy, parsePageOptions, type PageCacheInfo, type PageOptions, type PageResult } from "./webpage";

interface CreateJobBody {
  urls?: unknown;
  mode?: unknown;
  url?: unknown;
  options?: {
    strategy?: unknown;
    output?: unknown;
    includeDiagnostics?: unknown;
    maxAttempts?: unknown;
    downloadImages?: unknown;
    renderStrategy?: unknown;
    width?: unknown;
    height?: unknown;
    fullPage?: unknown;
    store?: unknown;
    cacheMode?: unknown;
    cacheTtlSeconds?: unknown;
  };
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function notFound(): Response {
  return json({ error: "Not found" }, { status: 404 });
}

function configuredApiKey(env: Env): string {
  const key = env.WEB_ARCHIVE_API_KEY || env.WXARTICLE_API_KEY;
  if (!key) {
    throw new Error("API key binding is not configured");
  }
  return key;
}

async function readJsonBody(request: Request): Promise<CreateJobBody> {
  const length = request.headers.get("Content-Length");
  if (length && Number(length) > MAX_REQUEST_BYTES) {
    throw new Error(`Request body exceeds ${MAX_REQUEST_BYTES} bytes`);
  }
  const text = await request.text();
  if (text.length > MAX_REQUEST_BYTES) {
    throw new Error(`Request body exceeds ${MAX_REQUEST_BYTES} bytes`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Request body must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  return parsed as CreateJobBody;
}

function parseMaxAttempts(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_ATTEMPTS;
  }
  return Math.max(1, Math.min(6, Math.trunc(value)));
}

function parseUrls(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("urls must be an array");
  }
  if (value.length === 0) {
    throw new Error("urls must not be empty");
  }
  if (value.length > MAX_URLS_PER_JOB) {
    throw new Error(`urls must contain at most ${MAX_URLS_PER_JOB} items`);
  }
  const urls = value.map((item) => {
    if (typeof item !== "string") {
      throw new Error("every url must be a string");
    }
    return item.trim();
  });
  const invalid = urls.find((url) => !isAllowedWeChatArticleUrl(url));
  if (invalid) {
    throw new Error(`Only public https://mp.weixin.qq.com/s... article URLs are allowed: ${invalid}`);
  }
  return Array.from(new Set(urls));
}

function parseUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("url must be a string");
  }
  const url = value.trim();
  if (!isAllowedWeChatArticleUrl(url)) {
    throw new Error(`Only public https://mp.weixin.qq.com/s... article URLs are allowed: ${url}`);
  }
  return url;
}

function parseAsyncMode(value: unknown): AsyncStorageMode {
  if (value === "md-only" || value === "full") {
    return value;
  }
  throw new Error("mode must be either md-only or full");
}

function parseRenderStrategy(value: unknown): RenderStrategy {
  if (value === undefined || value === null) {
    return "fallback";
  }
  if (value === "never" || value === "fallback" || value === "always") {
    return value;
  }
  throw new Error("renderStrategy must be never, fallback, or always");
}

function assetResponse(object: R2ObjectBody): Response {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }
  return new Response(object.body, { headers });
}

function shouldStorePage(options: PageOptions): boolean {
  return options.store || options.cacheMode !== "none";
}

function shouldReadPageCache(options: PageOptions): boolean {
  return options.cacheMode === "reuse-if-fresh" || options.cacheMode === "stale-while-refresh";
}

function withCacheInfo(page: PageResult, cache: PageCacheInfo): PageResult {
  return { ...page, cache };
}

async function fetchStoreablePage(url: string, env: Env, options: PageOptions, readAttempted: boolean): Promise<PageResult> {
  let page: PageResult;
  try {
    page = await fetchAndConvertPageWithStrategy(url, env.BROWSER, options);
  } catch (error) {
    if (shouldStorePage(options)) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await recordCrawlFailure(env, url, message, options.cacheTtlSeconds);
      } catch (storageError) {
        const storageMessage = storageError instanceof Error ? storageError.message : String(storageError);
        console.error(JSON.stringify({ message: "crawl failure record failed", url, error: storageMessage }));
      }
    }
    throw error;
  }

  if (!shouldStorePage(options)) {
    return page;
  }
  const stored = await storeCrawlSnapshot(env, page, options.cacheTtlSeconds);
  return withCacheInfo(page, {
    mode: options.cacheMode,
    status: readAttempted ? "miss" : "stored",
    stored: true,
    ttlSeconds: options.cacheTtlSeconds,
    snapshotId: stored.snapshotId,
    resultKey: stored.resultKey,
    contentHash: stored.contentHash,
    storedAt: stored.storedAt
  });
}

async function refreshStoredPage(url: string, env: Env, options: PageOptions): Promise<void> {
  try {
    const page = await fetchAndConvertPageWithStrategy(url, env.BROWSER, options);
    await storeCrawlSnapshot(env, page, options.cacheTtlSeconds);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await recordCrawlFailure(env, url, message, options.cacheTtlSeconds);
    } catch (storageError) {
      const storageMessage = storageError instanceof Error ? storageError.message : String(storageError);
      console.error(JSON.stringify({ message: "crawl refresh failure record failed", url, error: storageMessage }));
    }
    console.error(JSON.stringify({ message: "crawl cache refresh failed", url, error: message }));
  }
}

async function fetchInlineCrawl(body: CreateJobBody, env: Env, ctx?: ExecutionContext): Promise<PageResult> {
  const pageUrl = parsePublicHttpsUrl(body.url);
  const options = parsePageOptions(body.options);
  const readAttempted = shouldReadPageCache(options);

  if (readAttempted) {
    const cached = await getLatestCrawlSnapshot(env, pageUrl);
    if (cached) {
      const cacheBase = {
        mode: options.cacheMode,
        ttlSeconds: options.cacheTtlSeconds,
        snapshotId: cached.cache.snapshotId,
        resultKey: cached.cache.resultKey,
        contentHash: cached.cache.contentHash,
        storedAt: cached.cache.storedAt,
        ageSeconds: cached.cache.ageSeconds
      };
      if (isStoredCrawlSnapshotFresh(cached, options.cacheTtlSeconds)) {
        return withCacheInfo(cached.page, {
          ...cacheBase,
          status: "hit"
        });
      }
      if (options.cacheMode === "stale-while-refresh") {
        const refresh = ctx ? "scheduled" : "unavailable";
        if (ctx) {
          ctx.waitUntil(refreshStoredPage(pageUrl, env, options));
        }
        return withCacheInfo(cached.page, {
          ...cacheBase,
          status: "stale",
          refresh
        });
      }
    }
  }

  return fetchStoreablePage(pageUrl, env, options, readAttempted);
}

export async function handleRequest(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  try {
    const authenticated = await verifyApiKey(request, configuredApiKey(env));
    if (!authenticated) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    if (request.method === "POST" && url.pathname === "/v1/jobs") {
      const body = await readJsonBody(request);
      const urls = parseUrls(body.urls);
      const maxAttempts = parseMaxAttempts(body.options?.maxAttempts);
      const job = await createJob(env, urls, maxAttempts, "md-only");
      return json(job, { status: 202 });
    }

    if (request.method === "POST" && url.pathname === "/v2/archive/inline") {
      const body = await readJsonBody(request);
      const articleUrl = parseUrl(body.url);
      const renderStrategy = parseRenderStrategy(body.options?.renderStrategy);
      const article = await fetchAndConvertArticleWithStrategy(articleUrl, env.BROWSER, renderStrategy);
      return json(article);
    }

    if (request.method === "POST" && url.pathname === "/v2/archive/rendered") {
      const body = await readJsonBody(request);
      const articleUrl = parseUrl(body.url);
      const article = await fetchAndConvertArticleWithStrategy(articleUrl, env.BROWSER, "always");
      return json(article);
    }

    if (request.method === "POST" && url.pathname === "/v2/jobs") {
      const body = await readJsonBody(request);
      const urls = parseUrls(body.urls);
      const mode = parseAsyncMode(body.mode);
      const maxAttempts = parseMaxAttempts(body.options?.maxAttempts);
      const renderStrategy = parseRenderStrategy(body.options?.renderStrategy);
      const job = await createJob(env, urls, maxAttempts, mode, renderStrategy);
      return json(job, { status: 202 });
    }

    if (request.method === "POST" && url.pathname === "/v2/screenshots/inline") {
      const body = await readJsonBody(request);
      const pageUrl = parsePublicHttpsUrl(body.url);
      const screenshotOptions = parseScreenshotOptions(body.options);
      const image = await captureScreenshot(env.BROWSER, pageUrl, screenshotOptions);
      return screenshotImageResponse(image);
    }

    if (request.method === "POST" && url.pathname === "/v2/screenshots") {
      const body = await readJsonBody(request);
      const pageUrl = parsePublicHttpsUrl(body.url);
      const screenshotOptions = parseScreenshotOptions(body.options);
      const screenshotId = crypto.randomUUID();
      try {
        const image = await captureScreenshot(env.BROWSER, pageUrl, screenshotOptions);
        const result = await storeScreenshot(env, screenshotId, pageUrl, image, screenshotOptions);
        return json(result, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordScreenshotFailure(env, screenshotId, pageUrl, screenshotOptions, message);
        throw error;
      }
    }

    if (request.method === "POST" && (url.pathname === "/v3/pages/inline" || url.pathname === "/v3/crawl/inline")) {
      const body = await readJsonBody(request);
      const page = await fetchInlineCrawl(body, env, ctx);
      return json(page);
    }

    const jobMatch = url.pathname.match(/^\/v1\/jobs\/([^/]+)$/);
    if (request.method === "GET" && jobMatch) {
      const job = await getJob(env, jobMatch[1]);
      return job ? json(job) : notFound();
    }

    const resultsMatch = url.pathname.match(/^\/v1\/jobs\/([^/]+)\/results$/);
    if (request.method === "GET" && resultsMatch) {
      const items = await listSucceededItems(env, resultsMatch[1]);
      return json({ jobId: resultsMatch[1], items });
    }

    const resultMatch = url.pathname.match(/^\/v1\/jobs\/([^/]+)\/results\/([^/]+)$/);
    if (request.method === "GET" && resultMatch) {
      const result = await getResult(env, resultMatch[1], resultMatch[2]);
      return result ? json(result) : notFound();
    }

    const v2JobMatch = url.pathname.match(/^\/v2\/jobs\/([^/]+)$/);
    if (request.method === "GET" && v2JobMatch) {
      const job = await getJob(env, v2JobMatch[1], "/v2");
      return job ? json(job) : notFound();
    }

    const v2ResultsMatch = url.pathname.match(/^\/v2\/jobs\/([^/]+)\/results$/);
    if (request.method === "GET" && v2ResultsMatch) {
      const items = await listSucceededItems(env, v2ResultsMatch[1], "/v2");
      return json({ jobId: v2ResultsMatch[1], items });
    }

    const v2ResultMatch = url.pathname.match(/^\/v2\/jobs\/([^/]+)\/results\/([^/]+)$/);
    if (request.method === "GET" && v2ResultMatch) {
      const result = await getResult(env, v2ResultMatch[1], v2ResultMatch[2]);
      return result ? json(result) : notFound();
    }

    const assetMatch = url.pathname.match(/^\/v2\/assets\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (request.method === "GET" && assetMatch) {
      const object = await getAsset(env, assetMatch[1], assetMatch[2], assetMatch[3]);
      return object ? assetResponse(object) : notFound();
    }

    const screenshotMatch = url.pathname.match(/^\/v2\/screenshots\/([^/]+)$/);
    if (request.method === "GET" && screenshotMatch) {
      const object = await getScreenshot(env, screenshotMatch[1]);
      return object ? assetResponse(object) : notFound();
    }

    return notFound();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Challenge page detected")
      ? 422
      : message.startsWith("Request body") ||
          message.includes("mode must") ||
          message.includes("renderStrategy") ||
          message.includes("strategy must") ||
          message.includes("output must") ||
          message.includes("cacheMode must") ||
          message.includes("cacheTtlSeconds must") ||
          message.includes("url") ||
          message.includes("Only public") ||
          message.includes("Private, local")
        ? 400
        : 500;
    console.error(JSON.stringify({ message: "request failed", path: url.pathname, error: message }));
    return json({ error: message }, { status });
  }
}
