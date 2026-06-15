import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import { readBoundedText, type FetchLike } from "./converter";
import { parsePublicHttpsUrl } from "./screenshot";
import { MAX_HTML_BYTES, MIN_USEFUL_MARKDOWN_CHARS, type BrowserQuickAction, type RenderStrategy } from "./types";

export type PageStrategy = "auto" | "browser-markdown" | "htmlrewriter" | "rehype";
export type PageOutput = "both" | "markdown" | "html";

export interface PageOptions {
  strategy: PageStrategy;
  output: PageOutput;
  renderStrategy: RenderStrategy;
  includeDiagnostics: boolean;
}

export interface PageDiagnostics {
  requestedStrategy: PageStrategy;
  staticBodyChars?: number;
  markdownChars?: number;
  htmlChars?: number;
  imageCount?: number;
  linkCount?: number;
  browserMsUsed?: number;
  attempts: Array<{
    strategy: Exclude<PageStrategy, "auto">;
    status: "succeeded" | "failed" | "skipped";
    reason?: string;
    durationMs?: number;
    browserMsUsed?: number;
  }>;
}

export interface PageResult {
  url: string;
  source: string;
  fetchedAt: string;
  title?: string;
  description?: string;
  canonicalUrl?: string;
  markdown?: string;
  html?: string;
  images: string[];
  links: string[];
  strategyUsed: Exclude<PageStrategy, "auto">;
  rendered: boolean;
  diagnostics?: PageDiagnostics;
}

interface PageBody {
  url?: unknown;
  options?: unknown;
}

interface PageExtraction {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  markdown: string;
  html: string;
  images: string[];
  links: string[];
  sourceHtmlChars: number;
}

interface BrowserTextResult {
  text: string;
  browserMsUsed?: number;
}

const ATTR_RE = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu;
const UNSAFE_BLOCK_TAGS = ["script", "style", "noscript", "iframe", "form", "object", "embed", "svg", "math", "canvas", "template"];
const UNSAFE_REMOVE_TAGS = new Set([...UNSAFE_BLOCK_TAGS, "input", "button", "select", "textarea", "option"]);
const ALLOWED_TAGS = new Set([
  "a",
  "article",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "img",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "ul"
]);
const VOID_TAGS = new Set(["br", "hr", "img"]);
const BLOCK_TAGS = new Set([
  "article",
  "blockquote",
  "div",
  "figcaption",
  "figure",
  "footer",
  "header",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul"
]);
const PAGE_SANITIZE_SCHEMA = {
  tagNames: Array.from(ALLOWED_TAGS),
  attributes: {
    "*": ["title"],
    a: ["href", "title"],
    blockquote: ["cite", "title"],
    img: ["alt", "src", "title"],
    q: ["cite", "title"],
    time: ["datetime", "title"]
  },
  protocols: {
    cite: ["http", "https"],
    href: ["http", "https", "mailto"],
    src: ["http", "https"]
  },
  clobberPrefix: "user-content-",
  strip: UNSAFE_BLOCK_TAGS
};

function nowMs(): number {
  return Date.now();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;|&apos;/gu, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function cleanText(value: string | undefined): string {
  return decodeHtml(value ?? "").replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ").trim();
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/"/gu, "&quot;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");
}

function attrsFromTag(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(ATTR_RE)) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeSafeUrl(raw: string | undefined, baseUrl: string, kind: "link" | "image" | "cite"): string | null {
  const value = (raw ?? "").trim();
  if (!value) {
    return null;
  }
  try {
    const normalized = value.startsWith("//") ? `https:${value}` : new URL(value, baseUrl).toString();
    const parsed = new URL(normalized);
    if (kind === "link" && parsed.protocol === "mailto:") {
      return normalized;
    }
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return normalized;
    }
  } catch {
    return null;
  }
  return null;
}

function extractMeta(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const re = new RegExp(`<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*>`, "iu");
  const match = re.exec(html);
  if (!match) {
    return "";
  }
  return cleanText(attrsFromTag(match[0]).content);
}

function extractCanonicalUrl(html: string, baseUrl: string): string | undefined {
  const match = /<link\b[^>]*\brel\s*=\s*(?:"[^"]*\bcanonical\b[^"]*"|'[^']*\bcanonical\b[^']*'|[^\s>]*\bcanonical\b[^\s>]*)[^>]*>/iu.exec(html);
  if (!match) {
    return undefined;
  }
  return normalizeSafeUrl(attrsFromTag(match[0]).href, baseUrl, "link") ?? undefined;
}

function extractMetadata(html: string, baseUrl: string, sanitizedHtml: string): Pick<PageExtraction, "title" | "description" | "canonicalUrl"> {
  const rawTitle =
    extractMeta(html, "og:title") ||
    extractMeta(html, "twitter:title") ||
    cleanText((/<title\b[^>]*>([\s\S]*?)<\/title>/iu.exec(html) ?? [])[1]) ||
    cleanText((/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu.exec(sanitizedHtml) ?? [])[1]);
  const description =
    extractMeta(html, "description") || extractMeta(html, "og:description") || extractMeta(html, "twitter:description");
  return {
    title: rawTitle || undefined,
    description: description || undefined,
    canonicalUrl: extractCanonicalUrl(html, baseUrl)
  };
}

function removeUnsafeBlocks(html: string): string {
  let output = html.replace(/<!--[\s\S]*?-->/gu, "").replace(/<!doctype\b[^>]*>/giu, "");
  for (const tag of UNSAFE_BLOCK_TAGS) {
    output = output.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "giu"), "");
  }
  return output;
}

export function sanitizeHtmlFragment(html: string, baseUrl: string): { html: string; images: string[]; links: string[] } {
  const images: string[] = [];
  const links: string[] = [];
  const cleaned = removeUnsafeBlocks(html).replace(/<\/?([a-zA-Z][\w:-]*)\b[^>]*>/gu, (tag, rawTagName: string) => {
    const lower = rawTagName.toLowerCase();
    const isClosing = /^<\s*\//u.test(tag);
    if (UNSAFE_REMOVE_TAGS.has(lower)) {
      return "";
    }
    if (!ALLOWED_TAGS.has(lower)) {
      return "";
    }
    if (isClosing) {
      return VOID_TAGS.has(lower) ? "" : `</${lower}>`;
    }

    const attrs = attrsFromTag(tag);
    const safeAttrs: string[] = [];
    if (lower === "a") {
      const href = normalizeSafeUrl(attrs.href, baseUrl, "link");
      if (href) {
        links.push(href);
        safeAttrs.push(`href="${escapeAttr(href)}"`);
      }
    }
    if (lower === "img") {
      const src = normalizeSafeUrl(attrs["data-src"] || attrs["data-original"] || attrs.src, baseUrl, "image");
      if (!src) {
        return "";
      }
      images.push(src);
      safeAttrs.push(`src="${escapeAttr(src)}"`);
      if (attrs.alt) {
        safeAttrs.push(`alt="${escapeAttr(cleanText(attrs.alt))}"`);
      }
    }
    if ((lower === "blockquote" || lower === "q") && attrs.cite) {
      const cite = normalizeSafeUrl(attrs.cite, baseUrl, "cite");
      if (cite) {
        safeAttrs.push(`cite="${escapeAttr(cite)}"`);
      }
    }
    if (lower === "time" && attrs.datetime) {
      safeAttrs.push(`datetime="${escapeAttr(cleanText(attrs.datetime))}"`);
    }
    if (attrs.title) {
      safeAttrs.push(`title="${escapeAttr(cleanText(attrs.title))}"`);
    }

    const suffix = VOID_TAGS.has(lower) ? "" : tag.endsWith("/>") ? "" : "";
    return safeAttrs.length > 0 ? `<${lower} ${safeAttrs.join(" ")}>${suffix}` : `<${lower}>${suffix}`;
  });

  const normalized = cleaned
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return {
    html: normalized,
    images: unique(images),
    links: unique(links)
  };
}

async function sanitizeWithRehype(html: string, baseUrl: string): Promise<{ html: string; images: string[]; links: string[] }> {
  const file = await unified()
    .use(rehypeParse, { fragment: false })
    .use(rehypeSanitize, PAGE_SANITIZE_SCHEMA)
    .use(rehypeStringify)
    .process(html);
  return sanitizeHtmlFragment(String(file), baseUrl);
}

async function sanitizeWithHtmlRewriter(html: string, baseUrl: string): Promise<{ html: string; images: string[]; links: string[] }> {
  if (typeof HTMLRewriter === "undefined") {
    return sanitizeHtmlFragment(html, baseUrl);
  }

  let rewriter = new HTMLRewriter();
  for (const tag of UNSAFE_BLOCK_TAGS) {
    rewriter = rewriter.on(tag, {
      element(element: Element) {
        element.remove();
      }
    });
  }

  rewriter = rewriter.on("*", {
    element(element: Element) {
      const tagName = element.tagName.toLowerCase();
      if (UNSAFE_REMOVE_TAGS.has(tagName)) {
        element.remove();
        return;
      }
      if (!ALLOWED_TAGS.has(tagName)) {
        element.removeAndKeepContent();
        return;
      }

      const hrefValue = element.getAttribute("href") ?? undefined;
      const imgValue = element.getAttribute("data-src") ?? element.getAttribute("data-original") ?? element.getAttribute("src") ?? undefined;
      const altValue = element.getAttribute("alt") ?? undefined;
      for (const [name] of Array.from(element.attributes)) {
        element.removeAttribute(name);
      }

      if (tagName === "a") {
        const href = normalizeSafeUrl(hrefValue, baseUrl, "link");
        if (href) {
          element.setAttribute("href", href);
        }
      }
      if (tagName === "img") {
        const src = normalizeSafeUrl(imgValue, baseUrl, "image");
        if (!src) {
          element.remove();
          return;
        }
        element.setAttribute("src", src);
        const alt = cleanText(altValue);
        if (alt) {
          element.setAttribute("alt", alt);
        }
      }
    }
  });
  const transformed = await rewriter
    .transform(new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }))
    .text();
  return sanitizeHtmlFragment(transformed, baseUrl);
}

function extractMainHtml(html: string): string {
  const article = /<article\b[^>]*>([\s\S]*?)<\/article>/iu.exec(html)?.[1];
  if (article && cleanText(article).length >= MIN_USEFUL_MARKDOWN_CHARS) {
    return `<article>${article}</article>`;
  }
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/iu.exec(html)?.[1];
  if (main && cleanText(main).length >= MIN_USEFUL_MARKDOWN_CHARS) {
    return `<main>${main}</main>`;
  }
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/iu.exec(html)?.[1];
  return body ? body.trim() : html;
}

function markdownInline(html: string): string {
  return cleanText(
    html
      .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/giu, (_, inner: string) => `\`${cleanText(inner)}\``)
      .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/giu, (_, _tag: string, inner: string) => `**${cleanText(inner)}**`)
      .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/giu, (_, _tag: string, inner: string) => `*${cleanText(inner)}*`)
  );
}

export function htmlToMarkdown(html: string): string {
  let text = html;
  text = text.replace(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/giu, (_, inner: string) => {
    const code = decodeHtml(inner.replace(/<[^>]+>/gu, "")).trim();
    return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
  });
  text = text.replace(/<img\b[^>]*>/giu, (tag) => {
    const attrs = attrsFromTag(tag);
    return attrs.src ? `\n\n![${cleanText(attrs.alt)}](${attrs.src})\n\n` : "";
  });
  text = text.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/giu, (tag, inner: string) => {
    const attrs = attrsFromTag(tag);
    const label = markdownInline(inner) || attrs.href;
    return attrs.href ? `[${label}](${attrs.href})` : label;
  });
  text = text.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/giu, (_, level: string, inner: string) => {
    return `\n\n${"#".repeat(Number(level))} ${markdownInline(inner)}\n\n`;
  });
  text = text
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<hr\s*\/?>/giu, "\n\n---\n\n")
    .replace(/<li\b[^>]*>/giu, "\n- ")
    .replace(/<\/(p|div|section|article|main|header|footer|figure|figcaption|blockquote|li|ul|ol|tr|table)>/giu, "\n\n")
    .replace(/<\/(td|th)>/giu, " | ")
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/giu, (_, _tag: string, inner: string) => `**${cleanText(inner)}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/giu, (_, _tag: string, inner: string) => `*${cleanText(inner)}*`)
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/giu, (_, inner: string) => `\`${cleanText(inner)}\``)
    .replace(/<[^>]+>/gu, "");

  return decodeHtml(text)
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function usefulMarkdown(markdown: string, images: string[]): boolean {
  const bodyChars = markdown
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith("# ") && !trimmed.startsWith(">");
    })
    .join("\n")
    .replace(/!\[[^\]]*\]\([^)]+\)/gu, "")
    .replace(/[[\]()*_`#>\-|]/gu, "")
    .replace(/\s+/gu, "").length;
  return bodyChars >= MIN_USEFUL_MARKDOWN_CHARS || images.length > 0;
}

function wantsHtml(options: PageOptions): boolean {
  return options.output === "both" || options.output === "html";
}

function wantsMarkdown(options: PageOptions): boolean {
  return options.output === "both" || options.output === "markdown";
}

function formatMarkdown(metadata: Pick<PageExtraction, "title">, url: string, markdown: string, fetchedAt: string): string {
  const title = metadata.title || "Untitled Web Page";
  return [`# ${title}`, "", `> Source: ${url}`, `> Fetched: ${fetchedAt}`, "", markdown].join("\n").trim() + "\n";
}

async function fetchStaticHtml(url: string, fetcher: FetchLike): Promise<string> {
  const response = await fetcher(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; wxarticle-archive/1.0; webpage-archive/1.0)",
      "Accept": "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) {
    response.body?.cancel();
    throw new Error(`Page fetch failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType && !/(?:text\/html|application\/xhtml\+xml|application\/xml|text\/xml)/iu.test(contentType)) {
    response.body?.cancel();
    throw new Error(`Page fetch returned unsupported content type: ${contentType}`);
  }
  return readBoundedText(response, MAX_HTML_BYTES);
}

async function extractStaticPage(
  url: string,
  strategy: "htmlrewriter" | "rehype",
  fetcher: FetchLike
): Promise<PageExtraction> {
  const rawHtml = await fetchStaticHtml(url, fetcher);
  const sanitized = strategy === "rehype" ? await sanitizeWithRehype(rawHtml, url) : await sanitizeWithHtmlRewriter(rawHtml, url);
  const html = extractMainHtml(sanitized.html);
  const metadata = extractMetadata(rawHtml, url, html);
  const markdown = htmlToMarkdown(html);
  return {
    ...metadata,
    markdown,
    html,
    images: sanitized.images,
    links: sanitized.links,
    sourceHtmlChars: rawHtml.length
  };
}

async function quickActionText(response: Response, label: string): Promise<BrowserTextResult> {
  const browserMsValue = Number(response.headers.get("X-Browser-Ms-Used") ?? "");
  const browserMsUsed = Number.isFinite(browserMsValue) && browserMsValue > 0 ? browserMsValue : undefined;
  if (!response.ok) {
    response.body?.cancel();
    throw new Error(`Browser Run ${label} failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  const text = await response.text();
  if (!contentType.includes("json")) {
    return { text, browserMsUsed };
  }
  const parsed = JSON.parse(text) as {
    result?: string | { content?: unknown; html?: unknown; markdown?: unknown };
    content?: unknown;
    html?: unknown;
    markdown?: unknown;
  };
  const result = parsed.result;
  const content = typeof result === "string" ? result : result?.markdown ?? result?.content ?? result?.html ?? parsed.markdown ?? parsed.content ?? parsed.html;
  if (typeof content !== "string") {
    throw new Error(`Browser Run ${label} response did not include text content`);
  }
  return { text: content, browserMsUsed };
}

async function extractBrowserPage(url: string, browser: BrowserQuickAction | undefined, options: PageOptions): Promise<PageExtraction & { browserMsUsed?: number }> {
  if (!browser) {
    throw new Error("Browser Run binding is not configured");
  }

  let browserMsUsed = 0;
  let rawHtml = "";
  let markdown = "";
  if (wantsHtml(options)) {
    const content = await quickActionText(
      await browser.quickAction("content", {
        url,
        gotoOptions: {
          waitUntil: options.renderStrategy === "always" ? "networkidle2" : "domcontentloaded",
          timeout: 30000
        }
      }),
      "content"
    );
    rawHtml = content.text;
    browserMsUsed += content.browserMsUsed ?? 0;
  }
  if (wantsMarkdown(options)) {
    const renderedMarkdown = await quickActionText(
      await browser.quickAction("markdown", {
        url,
        gotoOptions: {
          waitUntil: options.renderStrategy === "always" ? "networkidle2" : "domcontentloaded",
          timeout: 30000
        }
      }),
      "markdown"
    );
    markdown = renderedMarkdown.text.trim();
    browserMsUsed += renderedMarkdown.browserMsUsed ?? 0;
  }
  if (!rawHtml) {
    const content = await quickActionText(
      await browser.quickAction("content", {
        url,
        gotoOptions: {
          waitUntil: "domcontentloaded",
          timeout: 30000
        }
      }),
      "content"
    );
    rawHtml = content.text;
    browserMsUsed += content.browserMsUsed ?? 0;
  }

  const sanitized = sanitizeHtmlFragment(rawHtml, url);
  const html = extractMainHtml(sanitized.html);
  const metadata = extractMetadata(rawHtml, url, html);
  if (!markdown) {
    markdown = htmlToMarkdown(html);
  }
  return {
    ...metadata,
    markdown,
    html,
    images: sanitized.images,
    links: sanitized.links,
    sourceHtmlChars: rawHtml.length,
    browserMsUsed: browserMsUsed || undefined
  };
}

function createResult(
  url: string,
  fetchedAt: string,
  strategyUsed: Exclude<PageStrategy, "auto">,
  rendered: boolean,
  options: PageOptions,
  extraction: PageExtraction,
  diagnostics: PageDiagnostics
): PageResult {
  const markdown = formatMarkdown(extraction, url, extraction.markdown, fetchedAt);
  diagnostics.staticBodyChars = extraction.sourceHtmlChars;
  diagnostics.markdownChars = markdown.length;
  diagnostics.htmlChars = extraction.html.length;
  diagnostics.imageCount = extraction.images.length;
  diagnostics.linkCount = extraction.links.length;

  return {
    url,
    source: new URL(url).hostname,
    fetchedAt,
    title: extraction.title,
    description: extraction.description,
    canonicalUrl: extraction.canonicalUrl,
    markdown: wantsMarkdown(options) ? markdown : undefined,
    html: wantsHtml(options) ? extraction.html : undefined,
    images: extraction.images,
    links: extraction.links,
    strategyUsed,
    rendered,
    diagnostics: options.includeDiagnostics ? diagnostics : undefined
  };
}

function parseStrategy(value: unknown): PageStrategy {
  if (value === undefined || value === null) {
    return "auto";
  }
  if (value === "auto" || value === "browser-markdown" || value === "htmlrewriter" || value === "rehype") {
    return value;
  }
  throw new Error("strategy must be auto, browser-markdown, htmlrewriter, or rehype");
}

function parseOutput(value: unknown): PageOutput {
  if (value === undefined || value === null) {
    return "both";
  }
  if (value === "both" || value === "markdown" || value === "html") {
    return value;
  }
  throw new Error("output must be both, markdown, or html");
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

export function parsePageOptions(value: unknown): PageOptions {
  const options = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    strategy: parseStrategy(options.strategy),
    output: parseOutput(options.output),
    renderStrategy: parseRenderStrategy(options.renderStrategy),
    includeDiagnostics: typeof options.includeDiagnostics === "boolean" ? options.includeDiagnostics : true
  };
}

export async function fetchAndConvertPageWithStrategy(
  urlValue: unknown,
  browser: BrowserQuickAction | undefined,
  options: PageOptions,
  fetcher: FetchLike = fetch
): Promise<PageResult> {
  const url = parsePublicHttpsUrl(urlValue);
  const fetchedAt = new Date().toISOString();
  const diagnostics: PageDiagnostics = {
    requestedStrategy: options.strategy,
    attempts: []
  };

  async function runStatic(strategy: "htmlrewriter" | "rehype"): Promise<PageResult> {
    const started = nowMs();
    try {
      const extraction = await extractStaticPage(url, strategy, fetcher);
      diagnostics.attempts.push({ strategy, status: "succeeded", durationMs: nowMs() - started });
      return createResult(url, fetchedAt, strategy, false, options, extraction, diagnostics);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      diagnostics.attempts.push({ strategy, status: "failed", reason, durationMs: nowMs() - started });
      throw error;
    }
  }

  async function runBrowser(): Promise<PageResult> {
    const started = nowMs();
    try {
      const extraction = await extractBrowserPage(url, browser, options);
      diagnostics.browserMsUsed = extraction.browserMsUsed;
      diagnostics.attempts.push({
        strategy: "browser-markdown",
        status: "succeeded",
        durationMs: nowMs() - started,
        browserMsUsed: extraction.browserMsUsed
      });
      return createResult(url, fetchedAt, "browser-markdown", true, options, extraction, diagnostics);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      diagnostics.attempts.push({ strategy: "browser-markdown", status: "failed", reason, durationMs: nowMs() - started });
      throw error;
    }
  }

  if (options.strategy === "browser-markdown" || options.renderStrategy === "always") {
    return runBrowser();
  }
  if (options.strategy === "htmlrewriter") {
    return runStatic("htmlrewriter");
  }
  if (options.strategy === "rehype") {
    return runStatic("rehype");
  }

  let staticResult: PageResult | null = null;
  let staticError: unknown = null;
  try {
    staticResult = await runStatic("htmlrewriter");
    if (options.renderStrategy === "never" || usefulMarkdown(staticResult.markdown ?? "", staticResult.images)) {
      return staticResult;
    }
  } catch (error) {
    staticError = error;
    if (options.renderStrategy === "never") {
      throw error;
    }
  }

  try {
    return await runBrowser();
  } catch (browserError) {
    if (staticResult) {
      return staticResult;
    }
    const staticMessage = staticError instanceof Error ? staticError.message : String(staticError);
    const browserMessage = browserError instanceof Error ? browserError.message : String(browserError);
    throw new Error(`Static page fetch failed (${staticMessage}); Browser Run fallback failed (${browserMessage})`);
  }
}

export async function fetchInlinePage(body: PageBody, browser: BrowserQuickAction | undefined, fetcher: FetchLike = fetch): Promise<PageResult> {
  return fetchAndConvertPageWithStrategy(body.url, browser, parsePageOptions(body.options), fetcher);
}
