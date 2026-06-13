/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  RESULTS: R2Bucket;
  ARTICLE_QUEUE: Queue<import("./types").QueueMessageBody>;
  WXARTICLE_API_KEY: string;
}
