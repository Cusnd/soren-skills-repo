import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { processQueueMessage } from "../src/queue";
import type { ItemRow, QueueMessageBody } from "../src/types";

const fixture = readFileSync(join(process.cwd(), "test/fixtures/wechat-article.html"), "utf-8");

function mockEnv(item: ItemRow): Env {
  const put = vi.fn(async () => undefined);
  return {
    WXARTICLE_API_KEY: "secret",
    DB: {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn(() => ({
          run: vi.fn(async () => ({ success: true })),
          first: vi.fn(async () => (sql.startsWith("SELECT * FROM items") ? item : null)),
          all: vi.fn(async () => ({ results: [{ status: "succeeded", count: 1 }] }))
        }))
      }))
    },
    ARTICLE_QUEUE: {},
    RESULTS: {
      put
    }
  } as unknown as Env;
}

describe("queue", () => {
  it("converts an item and stores the JSON result in R2", async () => {
    const item: ItemRow = {
      job_id: "job-1",
      item_id: "item-1",
      url: "https://mp.weixin.qq.com/s/example",
      status: "queued",
      attempts: 0,
      max_attempts: 4,
      error: null,
      result_key: null,
      result_kind: null,
      created_at: "2026-06-13T00:00:00.000Z",
      updated_at: "2026-06-13T00:00:00.000Z"
    };
    const env = mockEnv(item);
    const body: QueueMessageBody = {
      jobId: item.job_id,
      itemId: item.item_id,
      url: item.url,
      maxAttempts: 4
    };
    const retry = vi.fn();
    const fetcher = vi.fn(async () => new Response(fixture, { status: 200, headers: { "Content-Type": "text/html" } }));

    await processQueueMessage(env, body, retry, fetcher);

    expect(fetcher).toHaveBeenCalledWith(item.url, expect.any(Object));
    expect(env.RESULTS.put).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("stores article JSON and image objects for full mode", async () => {
    const item: ItemRow = {
      job_id: "job-2",
      item_id: "item-2",
      url: "https://mp.weixin.qq.com/s/example",
      status: "queued",
      attempts: 0,
      max_attempts: 4,
      error: null,
      result_key: null,
      result_kind: null,
      created_at: "2026-06-13T00:00:00.000Z",
      updated_at: "2026-06-13T00:00:00.000Z"
    };
    const env = mockEnv(item);
    const body: QueueMessageBody = {
      jobId: item.job_id,
      itemId: item.item_id,
      url: item.url,
      maxAttempts: 4,
      mode: "full"
    };
    const retry = vi.fn();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === item.url) {
        return new Response(fixture, { status: 200, headers: { "Content-Type": "text/html" } });
      }
      return new Response("image-bytes", { status: 200, headers: { "Content-Type": "image/jpeg" } });
    });

    await processQueueMessage(env, body, retry, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(env.RESULTS.put).toHaveBeenCalledTimes(2);
    expect(vi.mocked(env.RESULTS.put).mock.calls[0][0]).toContain("/images/");
    expect(vi.mocked(env.RESULTS.put).mock.calls[1][0]).toContain("/article.json");
    expect(retry).not.toHaveBeenCalled();
  });
});
