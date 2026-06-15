import {
  MAX_HTML_BYTES,
  MIN_USEFUL_MARKDOWN_CHARS,
  type ArticleResult,
  type BrowserQuickAction,
  type RenderStrategy
} from "./types";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const ATTR_RE = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu;

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

function normalizeArticleTitle(value: string): string {
  return value.replace(/\s+-\s+微信公众平台\s*$/u, "").trim();
}

function attrsFromTag(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(ATTR_RE)) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function normalizeUrl(raw: string | undefined, baseUrl: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.startsWith("data:")) {
    return null;
  }
  try {
    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function findElementById(html: string, id: string): string | null {
  const startRe = new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*\\bid\\s*=\\s*["']?${id}["']?[^>]*>`, "iu");
  const startMatch = startRe.exec(html);
  if (!startMatch || startMatch.index === undefined) {
    return null;
  }

  const tagName = startMatch[1].toLowerCase();
  const contentStart = startMatch.index + startMatch[0].length;
  const tagRe = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "giu");
  let depth = 1;
  for (const match of html.slice(contentStart).matchAll(tagRe)) {
    const tag = match[0];
    const absoluteStart = contentStart + (match.index ?? 0);
    if (tag.startsWith(`</`)) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(contentStart, absoluteStart);
      }
    } else if (!tag.endsWith("/>")) {
      depth += 1;
    }
  }
  return null;
}

function extractTextById(html: string, id: string): string {
  return cleanText(findElementById(html, id) ?? "");
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

function readQuotedJsString(source: string, quoteIndex: number): string {
  const quote = source[quoteIndex];
  if (quote !== "'" && quote !== '"') {
    return "";
  }

  let output = "";
  for (let index = quoteIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === quote) {
      return output;
    }
    if (char !== "\\") {
      output += char;
      continue;
    }

    index += 1;
    const escaped = source[index];
    if (!escaped) {
      break;
    }
    if (escaped === "\n" || escaped === "\r") {
      if (escaped === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }
    switch (escaped) {
      case "n":
        output += "\n";
        break;
      case "r":
        output += "\r";
        break;
      case "t":
        output += "\t";
        break;
      case "b":
        output += "\b";
        break;
      case "f":
        output += "\f";
        break;
      case "v":
        output += "\v";
        break;
      case "x": {
        const hex = source.slice(index + 1, index + 3);
        if (/^[0-9a-f]{2}$/iu.test(hex)) {
          output += String.fromCodePoint(Number.parseInt(hex, 16));
          index += 2;
        } else {
          output += escaped;
        }
        break;
      }
      case "u": {
        if (source[index + 1] === "{") {
          const end = source.indexOf("}", index + 2);
          const hex = end > -1 ? source.slice(index + 2, end) : "";
          if (/^[0-9a-f]+$/iu.test(hex)) {
            output += String.fromCodePoint(Number.parseInt(hex, 16));
            index = end;
            break;
          }
        }
        const hex = source.slice(index + 1, index + 5);
        if (/^[0-9a-f]{4}$/iu.test(hex)) {
          output += String.fromCharCode(Number.parseInt(hex, 16));
          index += 4;
        } else {
          output += escaped;
        }
        break;
      }
      default:
        output += escaped;
        break;
    }
  }
  return "";
}

function extractJsPropertyString(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`\\b${escaped}\\s*:\\s*(['"])`, "u").exec(html);
  if (!match || match.index === undefined) {
    return "";
  }
  return readQuotedJsString(html, match.index + match[0].length - 1).trim();
}

function extractWindowString(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`\\bwindow\\.${escaped}\\s*=\\s*(?:window\\.[\\w$]+\\s*=\\s*)?(['"])`, "u").exec(html);
  if (!match || match.index === undefined) {
    return "";
  }
  return readQuotedJsString(html, match.index + match[0].length - 1).trim();
}

function extractArticleContent(html: string): string {
  return findElementById(html, "js_content") || extractJsPropertyString(html, "content_noencode") || extractJsPropertyString(html, "content");
}

function stripUnsafe(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/giu, "")
    .replace(/<style\b[\s\S]*?<\/style>/giu, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/giu, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/giu, "");
}

function convertContentToMarkdown(html: string, baseUrl: string): { markdown: string; images: string[] } {
  const images: string[] = [];
  let text = stripUnsafe(html);

  text = text.replace(/<img\b[^>]*>/giu, (tag) => {
    const attrs = attrsFromTag(tag);
    const src = normalizeUrl(attrs["data-src"] || attrs["data-original"] || attrs["data-backsrc"] || attrs.src, baseUrl);
    if (!src) {
      return "";
    }
    images.push(src);
    const alt = cleanText(attrs.alt);
    return `\n\n![${alt}](${src})\n\n`;
  });

  text = text
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/giu, (_, _tag: string, inner: string) => `**${cleanText(inner)}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/giu, (_, _tag: string, inner: string) => `*${cleanText(inner)}*`)
    .replace(/<li\b[^>]*>/giu, "\n- ")
    .replace(/<\/(p|div|section|article|h[1-6]|blockquote|li)>/giu, "\n\n")
    .replace(/<[^>]+>/gu, "");

  const markdown = decodeHtml(text)
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

  return { markdown, images: Array.from(new Set(images)) };
}

function markdownBodyChars(markdown: string): number {
  const body = markdown
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith("# ") && !trimmed.startsWith(">");
    })
    .join("\n")
    .replace(/!\[[^\]]*\]\([^)]+\)/gu, "")
    .replace(/[*_`#[\]()>\-]/gu, "")
    .replace(/\s+/gu, "");
  return body.length;
}

function hasUsefulMarkdownBody(article: ArticleResult): boolean {
  return markdownBodyChars(article.markdown) >= MIN_USEFUL_MARKDOWN_CHARS || article.images.length > 0;
}

async function readBoundedText(response: Response, maxBytes = MAX_HTML_BYTES): Promise<string> {
  const length = response.headers.get("Content-Length");
  if (length && Number(length) > maxBytes) {
    response.body?.cancel();
    throw new Error(`HTML response exceeds ${maxBytes} bytes`);
  }
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error(`HTML response exceeds ${maxBytes} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

export function isAllowedWeChatArticleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "mp.weixin.qq.com" && (url.pathname === "/s" || url.pathname.startsWith("/s/"));
  } catch {
    return false;
  }
}

export function convertHtmlToArticle(html: string, url: string, fetchedAt = new Date().toISOString()): ArticleResult {
  const content = extractArticleContent(html);
  if (!content) {
    throw new Error("Could not find WeChat article content in #js_content or content_noencode");
  }

  const rawTitle =
    extractTextById(html, "activity-name") ||
    extractMeta(html, "og:title") ||
    extractWindowString(html, "msg_title") ||
    extractWindowString(html, "title") ||
    cleanText((/<title\b[^>]*>([\s\S]*?)<\/title>/iu.exec(html) ?? [])[1]);
  const title = normalizeArticleTitle(rawTitle) || "Untitled WeChat Article";
  const author = extractTextById(html, "js_name") || extractMeta(html, "article:author") || extractJsPropertyString(html, "author");
  const publishedAt =
    extractTextById(html, "publish_time") ||
    extractMeta(html, "article:published_time") ||
    extractJsPropertyString(html, "create_time");
  const converted = convertContentToMarkdown(content, url);
  const metadata = [
    `# ${title}`,
    "",
    `> Source: ${url}`,
    author ? `> Author: ${author}` : undefined,
    publishedAt ? `> Published: ${publishedAt}` : undefined,
    `> Fetched: ${fetchedAt}`
  ].filter((line): line is string => Boolean(line));

  return {
    url,
    title,
    author: author || undefined,
    publishedAt: publishedAt || undefined,
    markdown: `${metadata.join("\n")}\n\n${converted.markdown}\n`,
    images: converted.images,
    sourceFetchedAt: fetchedAt
  };
}

export async function fetchAndConvertArticle(url: string, fetcher: FetchLike = fetch): Promise<ArticleResult> {
  if (!isAllowedWeChatArticleUrl(url)) {
    throw new Error("Only public https://mp.weixin.qq.com/s... article URLs are allowed");
  }

  const response = await fetcher(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; wxarticle-archive/1.0)",
      "Accept": "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) {
    response.body?.cancel();
    throw new Error(`Article fetch failed with HTTP ${response.status}`);
  }

  const fetchedAt = new Date().toISOString();
  const html = await readBoundedText(response);
  return convertHtmlToArticle(html, url, fetchedAt);
}

async function quickActionText(response: Response): Promise<string> {
  if (!response.ok) {
    response.body?.cancel();
    throw new Error(`Browser Run content failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  const text = await response.text();
  if (!contentType.includes("json")) {
    return text;
  }

  const parsed = JSON.parse(text) as {
    result?: string | { content?: unknown; html?: unknown };
    content?: unknown;
    html?: unknown;
  };
  const result = parsed.result;
  const content = typeof result === "string" ? result : result?.content ?? result?.html ?? parsed.content ?? parsed.html;
  if (typeof content !== "string") {
    throw new Error("Browser Run content response did not include HTML content");
  }
  return content;
}

export async function renderAndConvertArticle(url: string, browser: BrowserQuickAction): Promise<ArticleResult> {
  if (!isAllowedWeChatArticleUrl(url)) {
    throw new Error("Only public https://mp.weixin.qq.com/s... article URLs are allowed");
  }
  if (!browser) {
    throw new Error("Browser Run binding is not configured");
  }

  const response = await browser.quickAction("content", {
    url,
    gotoOptions: {
      waitUntil: "networkidle2",
      timeout: 30000
    }
  });
  const fetchedAt = new Date().toISOString();
  const html = await quickActionText(response);
  const article = convertHtmlToArticle(html, url, fetchedAt);
  article.rendered = true;
  return article;
}

export async function fetchAndConvertArticleWithStrategy(
  url: string,
  browser: BrowserQuickAction | undefined,
  strategy: RenderStrategy = "fallback",
  fetcher: FetchLike = fetch
): Promise<ArticleResult> {
  if (strategy === "always") {
    return renderAndConvertArticle(url, browser as BrowserQuickAction);
  }

  let staticArticle: ArticleResult | null = null;
  let staticError: unknown = null;
  try {
    staticArticle = await fetchAndConvertArticle(url, fetcher);
    if (strategy === "never" || hasUsefulMarkdownBody(staticArticle)) {
      return staticArticle;
    }
  } catch (error) {
    staticError = error;
    if (strategy === "never") {
      throw error;
    }
  }

  try {
    return await renderAndConvertArticle(url, browser as BrowserQuickAction);
  } catch (renderError) {
    if (staticArticle) {
      return staticArticle;
    }
    const staticMessage = staticError instanceof Error ? staticError.message : String(staticError);
    const renderMessage = renderError instanceof Error ? renderError.message : String(renderError);
    throw new Error(`Static fetch failed (${staticMessage}); Browser Run fallback failed (${renderMessage})`);
  }
}
