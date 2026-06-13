import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleRequest } from "../src/http";

const fixture = readFileSync(join(process.cwd(), "test/fixtures/wechat-article.html"), "utf-8");

function mockStatement() {
  return {
    bind: vi.fn(() => ({
      run: vi.fn(async () => ({ success: true })),
      first: vi.fn(async () => null),
      all: vi.fn(async () => ({ results: [] }))
    }))
  };
}

function mockEnv(): Env {
  return {
    WXARTICLE_API_KEY: "secret",
    DB: {
      prepare: vi.fn(() => mockStatement()),
      batch: vi.fn(async () => [])
    },
    ARTICLE_QUEUE: {
      sendBatch: vi.fn(async () => undefined)
    },
    RESULTS: {
      get: vi.fn(async () => null)
    }
  } as unknown as Env;
}

describe("http api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects missing API key", async () => {
    const response = await handleRequest(new Request("https://api.test/v1/jobs"), mockEnv());
    expect(response.status).toBe(401);
  });

  it("rejects non-WeChat article URLs", async () => {
    const response = await handleRequest(
      new Request("https://api.test/v1/jobs", {
        method: "POST",
        headers: { "X-API-Key": "secret" },
        body: JSON.stringify({ urls: ["https://example.com/post"] })
      }),
      mockEnv()
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("Only public") });
  });

  it("creates a job and queues items", async () => {
    const env = mockEnv();
    const response = await handleRequest(
      new Request("https://api.test/v1/jobs", {
        method: "POST",
        headers: { "X-API-Key": "secret" },
        body: JSON.stringify({ urls: ["https://mp.weixin.qq.com/s/example"], options: { maxAttempts: 4 } })
      }),
      env
    );
    const body = await response.json() as { jobId: string; status: string };
    expect(response.status).toBe(202);
    expect(body.jobId).toBeTruthy();
    expect(body.status).toBe("queued");
    expect(env.DB.batch).toHaveBeenCalledTimes(1);
    expect(env.ARTICLE_QUEUE.sendBatch).toHaveBeenCalledTimes(1);
  });

  it("returns inline v2 archives without writing D1, Queue, or R2", async () => {
    const env = mockEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixture, { status: 200, headers: { "Content-Type": "text/html" } }))
    );

    const response = await handleRequest(
      new Request("https://api.test/v2/archive/inline", {
        method: "POST",
        headers: { "X-API-Key": "secret" },
        body: JSON.stringify({ url: "https://mp.weixin.qq.com/s/example" })
      }),
      env
    );
    const body = await response.json() as { title: string; markdown: string };

    expect(response.status).toBe(200);
    expect(body.title).toBe("Fixture Title");
    expect(body.markdown).toContain("Hello **world**.");
    expect(env.DB.batch).not.toHaveBeenCalled();
    expect(env.ARTICLE_QUEUE.sendBatch).not.toHaveBeenCalled();
  });

  it("creates v2 full jobs and queues the selected mode", async () => {
    const env = mockEnv();
    const response = await handleRequest(
      new Request("https://api.test/v2/jobs", {
        method: "POST",
        headers: { "X-API-Key": "secret" },
        body: JSON.stringify({ urls: ["https://mp.weixin.qq.com/s/example"], mode: "full" })
      }),
      env
    );
    const batch = vi.mocked(env.ARTICLE_QUEUE.sendBatch).mock.calls[0][0] as Array<{ body: { mode: string } }>;

    expect(response.status).toBe(202);
    expect(batch[0].body.mode).toBe("full");
  });
});
