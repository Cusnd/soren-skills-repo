import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { convertHtmlToArticle, isAllowedWeChatArticleUrl } from "../src/converter";

const fixture = readFileSync(join(process.cwd(), "test/fixtures/wechat-article.html"), "utf-8");

describe("converter", () => {
  it("allows only public WeChat article URLs", () => {
    expect(isAllowedWeChatArticleUrl("https://mp.weixin.qq.com/s/example")).toBe(true);
    expect(isAllowedWeChatArticleUrl("https://mp.weixin.qq.com/s?__biz=abc")).toBe(true);
    expect(isAllowedWeChatArticleUrl("http://mp.weixin.qq.com/s/example")).toBe(false);
    expect(isAllowedWeChatArticleUrl("https://example.com/s/example")).toBe(false);
  });

  it("extracts title, metadata, markdown, and lazy images", () => {
    const article = convertHtmlToArticle(fixture, "https://mp.weixin.qq.com/s/example", "2026-06-13T00:00:00.000Z");
    expect(article.title).toBe("Fixture Title");
    expect(article.author).toBe("Example Author");
    expect(article.publishedAt).toBe("2026-01-02");
    expect(article.images).toEqual(["https://mmbiz.qpic.cn/demo/640?wx_fmt=jpeg"]);
    expect(article.markdown).toContain("# Fixture Title");
    expect(article.markdown).toContain("Hello **world**.");
    expect(article.markdown).toContain("https://mmbiz.qpic.cn/demo/640?wx_fmt=jpeg");
  });

  it("extracts newer WeChat pages that inline content_noencode", () => {
    const html = `
      <html><head><title></title></head><body>
      <script>
        window.msg_title = window.title = 'JS Title' || '';
        window.item = {
          content_noencode: 'Hello\\x0a\\x3ca href=\\x22https://example.com\\x22\\x3elink\\x3c/a\\x3e',
          create_time: '2026-04-28 10:45',
          author: 'Inline Author'
        };
      </script>
      </body></html>
    `;
    const article = convertHtmlToArticle(html, "https://mp.weixin.qq.com/s/example", "2026-06-13T00:00:00.000Z");

    expect(article.title).toBe("JS Title");
    expect(article.author).toBe("Inline Author");
    expect(article.publishedAt).toBe("2026-04-28 10:45");
    expect(article.markdown).toContain("Hello");
    expect(article.markdown).toContain("link");
  });
});
