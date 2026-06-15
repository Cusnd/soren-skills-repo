import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  fetchAndConvertPageWithStrategy,
  htmlToMarkdown,
  parsePageOptions,
  sanitizeHtmlFragment
} from "../src/webpage";

const fixture = readFileSync(join(process.cwd(), "test/fixtures/webpage.html"), "utf-8");

describe("webpage archival", () => {
  it("sanitizes HTML with an allowlist and normalizes page assets", () => {
    const sanitized = sanitizeHtmlFragment(fixture, "https://example.com/base/page");

    expect(sanitized.html).toContain("<strong>");
    expect(sanitized.html).toContain('href="https://example.com/docs"');
    expect(sanitized.html).toContain('src="https://example.com/images/example.jpg"');
    expect(sanitized.html).not.toContain("<script");
    expect(sanitized.html).not.toContain("<style");
    expect(sanitized.html).not.toContain("<iframe");
    expect(sanitized.html).not.toContain("onclick");
    expect(sanitized.html).not.toContain("javascript:");
    expect(sanitized.images).toEqual(["https://example.com/images/example.jpg"]);
    expect(sanitized.links).toEqual(["https://example.com/nav", "https://example.com/docs"]);
  });

  it("converts cleaned HTML to readable Markdown", () => {
    const markdown = htmlToMarkdown(sanitizeHtmlFragment(fixture, "https://example.com/").html);

    expect(markdown).toContain("# Fixture Web Page");
    expect(markdown).toContain("Hello **generic** archive.");
    expect(markdown).toContain("[the docs](https://example.com/docs)");
    expect(markdown).toContain("![Example image](https://example.com/images/example.jpg)");
  });

  it("parses safe defaults and rejects invalid options", () => {
    expect(parsePageOptions(undefined)).toEqual({
      strategy: "auto",
      output: "both",
      renderStrategy: "fallback",
      includeDiagnostics: true
    });
    expect(() => parsePageOptions({ strategy: "bad" })).toThrow("strategy must");
    expect(() => parsePageOptions({ output: "bad" })).toThrow("output must");
  });

  it("rejects unsafe page URLs before fetching", async () => {
    const fetcher = vi.fn();
    await expect(
      fetchAndConvertPageWithStrategy("https://localhost/admin", undefined, parsePageOptions(undefined), fetcher)
    ).rejects.toThrow("Private, local");
    await expect(
      fetchAndConvertPageWithStrategy("https://user:pass@example.com/", undefined, parsePageOptions(undefined), fetcher)
    ).rejects.toThrow("Only public HTTPS");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("archives static pages with the htmlrewriter strategy", async () => {
    const fetcher = vi.fn(async () => new Response(fixture, { status: 200, headers: { "Content-Type": "text/html" } }));
    const result = await fetchAndConvertPageWithStrategy(
      "https://example.com/articles/fixture",
      undefined,
      parsePageOptions({ strategy: "htmlrewriter" }),
      fetcher
    );

    expect(result.strategyUsed).toBe("htmlrewriter");
    expect(result.rendered).toBe(false);
    expect(result.title).toBe("Fixture Web Page");
    expect(result.description).toBe("A fixture page for generic web archival.");
    expect(result.canonicalUrl).toBe("https://example.com/articles/fixture");
    expect(result.html).toContain("<article>");
    expect(result.markdown).toContain("# Fixture Web Page");
    expect(result.images).toEqual(["https://example.com/images/example.jpg"]);
    expect(result.links).toContain("https://example.com/docs");
    expect(result.diagnostics?.attempts[0]).toMatchObject({ strategy: "htmlrewriter", status: "succeeded" });
  });

  it("archives static pages with the rehype strategy", async () => {
    const fetcher = vi.fn(async () => new Response(fixture, { status: 200, headers: { "Content-Type": "text/html" } }));
    const result = await fetchAndConvertPageWithStrategy(
      "https://example.com/articles/fixture",
      undefined,
      parsePageOptions({ strategy: "rehype" }),
      fetcher
    );

    expect(result.strategyUsed).toBe("rehype");
    expect(result.rendered).toBe(false);
    expect(result.html).not.toContain("javascript:");
    expect(result.markdown).toContain("[the docs](https://example.com/docs)");
  });

  it("falls back from short static pages to Browser Run markdown in auto mode", async () => {
    const shortHtml = "<html><head><title>Short</title></head><body><main><p>tiny</p></main></body></html>";
    const fetcher = vi.fn(async () => new Response(shortHtml, { status: 200, headers: { "Content-Type": "text/html" } }));
    const browser = {
      quickAction: vi.fn(async (action: "content" | "markdown") => {
        if (action === "markdown") {
          return new Response(JSON.stringify({ result: "# Rendered\n\nLong rendered body from the browser." }), {
            headers: { "Content-Type": "application/json", "X-Browser-Ms-Used": "123" }
          });
        }
        return new Response(fixture, {
          headers: { "Content-Type": "text/html", "X-Browser-Ms-Used": "77" }
        });
      })
    };

    const result = await fetchAndConvertPageWithStrategy(
      "https://example.com/articles/fixture",
      browser,
      parsePageOptions(undefined),
      fetcher
    );

    expect(result.strategyUsed).toBe("browser-markdown");
    expect(result.rendered).toBe(true);
    expect(result.markdown).toContain("Long rendered body");
    expect(result.diagnostics?.browserMsUsed).toBe(200);
    expect(browser.quickAction).toHaveBeenCalledWith("content", expect.any(Object));
    expect(browser.quickAction).toHaveBeenCalledWith("markdown", expect.any(Object));
  });

  it("returns static output when Browser Run fallback fails after useful static extraction", async () => {
    const fetcher = vi.fn(async () => new Response(fixture, { status: 200, headers: { "Content-Type": "text/html" } }));
    const browser = {
      quickAction: vi.fn(async () => new Response("browser down", { status: 500 }))
    };

    const result = await fetchAndConvertPageWithStrategy(
      "https://example.com/articles/fixture",
      browser,
      parsePageOptions(undefined),
      fetcher
    );

    expect(result.strategyUsed).toBe("htmlrewriter");
    expect(result.rendered).toBe(false);
    expect(browser.quickAction).not.toHaveBeenCalled();
  });

  it("omits diagnostics when requested", async () => {
    const fetcher = vi.fn(async () => new Response(fixture, { status: 200, headers: { "Content-Type": "text/html" } }));
    const result = await fetchAndConvertPageWithStrategy(
      "https://example.com/articles/fixture",
      undefined,
      parsePageOptions({ strategy: "htmlrewriter", includeDiagnostics: false }),
      fetcher
    );

    expect(result.diagnostics).toBeUndefined();
  });
});
