import { handleRequest } from "./http";
import { processQueueMessage } from "./queue";
import type { QueueMessageBody } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  async queue(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      await processQueueMessage(env, message.body, (delaySeconds) => {
        message.retry({ delaySeconds });
      });
    }
  }
} satisfies ExportedHandler<Env, QueueMessageBody>;

export { convertHtmlToArticle, fetchAndConvertArticle, isAllowedWeChatArticleUrl } from "./converter";
export { handleRequest } from "./http";
export { processQueueMessage } from "./queue";
export { fetchAndConvertPageWithStrategy } from "./webpage";
