#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const strategies = ["auto", "browser-markdown", "htmlrewriter", "rehype"];
const apiBase = process.env.WEB_ARCHIVE_API_BASE || process.env.WXARTICLE_API_BASE;
const apiKey = process.env.WEB_ARCHIVE_API_KEY || process.env.WXARTICLE_API_KEY;

if (!apiBase || !apiKey) {
  console.error("Set WEB_ARCHIVE_API_BASE and WEB_ARCHIVE_API_KEY (or legacy WXARTICLE_API_BASE/WXARTICLE_API_KEY) to run the remote webpage benchmark.");
  process.exit(2);
}

const urlPath = process.argv[2] || join(process.cwd(), "test/fixtures/webpage-benchmark-urls.json");
const urls = JSON.parse(readFileSync(urlPath, "utf-8"));

if (!Array.isArray(urls) || urls.some((url) => typeof url !== "string")) {
  console.error("Benchmark URL file must be a JSON array of strings.");
  process.exit(2);
}

async function archive(url, strategy) {
  const started = performance.now();
  const response = await fetch(`${apiBase.replace(/\/+$/u, "")}/v3/crawl/inline`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json; charset=utf-8",
      "X-API-Key": apiKey
    },
    body: JSON.stringify({
      url,
      options: {
        strategy,
        output: "both",
        renderStrategy: "fallback",
        includeDiagnostics: true
      }
    })
  });
  const elapsedMs = Math.round(performance.now() - started);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text.slice(0, 200) };
  }
  return {
    url,
    strategy,
    ok: response.ok,
    status: response.status,
    elapsedMs,
    strategyUsed: body.strategyUsed,
    rendered: body.rendered,
    title: body.title,
    markdownChars: body.markdown?.length ?? 0,
    htmlChars: body.html?.length ?? 0,
    images: body.images?.length ?? 0,
    links: body.links?.length ?? 0,
    browserMsUsed: body.diagnostics?.browserMsUsed ?? 0,
    error: body.error
  };
}

const results = [];
for (const url of urls) {
  for (const strategy of strategies) {
    try {
      const result = await archive(url, strategy);
      results.push(result);
      console.log(JSON.stringify(result));
    } catch (error) {
      const result = {
        url,
        strategy,
        ok: false,
        status: 0,
        elapsedMs: 0,
        error: error instanceof Error ? error.message : String(error)
      };
      results.push(result);
      console.log(JSON.stringify(result));
    }
  }
}

const summary = results.reduce(
  (memo, result) => {
    const item = memo[result.strategy] ?? {
      total: 0,
      succeeded: 0,
      elapsedMs: 0,
      browserMsUsed: 0,
      markdownChars: 0,
      htmlChars: 0
    };
    item.total += 1;
    item.succeeded += result.ok ? 1 : 0;
    item.elapsedMs += result.elapsedMs;
    item.browserMsUsed += result.browserMsUsed ?? 0;
    item.markdownChars += result.markdownChars ?? 0;
    item.htmlChars += result.htmlChars ?? 0;
    memo[result.strategy] = item;
    return memo;
  },
  {}
);

console.error("SUMMARY " + JSON.stringify(summary, null, 2));
