import { verifyApiKey } from "./auth";
import { fetchAndConvertArticleWithStrategy, isAllowedWeChatArticleUrl } from "./converter";
import { captureScreenshot, parsePublicHttpsUrl, parseScreenshotOptions, screenshotImageResponse } from "./screenshot";
import {
  createJob,
  getAsset,
  getJob,
  getResult,
  getScreenshot,
  listSucceededItems,
  recordScreenshotFailure,
  storeScreenshot
} from "./storage";
import {
  DEFAULT_MAX_ATTEMPTS,
  MAX_REQUEST_BYTES,
  MAX_URLS_PER_JOB,
  type AsyncStorageMode,
  type RenderStrategy
} from "./types";
import { fetchInlinePage } from "./webpage";

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

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  try {
    const authenticated = await verifyApiKey(request, env.WXARTICLE_API_KEY);
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

    if (request.method === "POST" && url.pathname === "/v3/pages/inline") {
      const body = await readJsonBody(request);
      const page = await fetchInlinePage(body, env.BROWSER);
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
          message.includes("url") ||
          message.includes("Only public") ||
          message.includes("Private, local")
        ? 400
        : 500;
    console.error(JSON.stringify({ message: "request failed", path: url.pathname, error: message }));
    return json({ error: message }, { status });
  }
}
