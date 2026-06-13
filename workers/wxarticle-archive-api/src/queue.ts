import { fetchAndConvertArticle, type FetchLike } from "./converter";
import {
  getItem,
  markItemFailed,
  markItemProcessing,
  markItemQueuedForRetry,
  markItemSucceeded,
  refreshJobCounts,
  storeImageAsset
} from "./storage";
import type { AsyncStorageMode, QueueMessageBody } from "./types";

export type RetryMessage = (delaySeconds: number) => void;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function retryDelaySeconds(attempts: number): number {
  return Math.min(300, 10 * 2 ** Math.max(0, attempts - 1));
}

export async function processQueueMessage(
  env: Env,
  body: QueueMessageBody,
  retry: RetryMessage,
  fetcher: FetchLike = fetch
): Promise<void> {
  const item = await getItem(env, body.jobId, body.itemId);
  if (!item) {
    console.warn(JSON.stringify({ message: "queue item missing", jobId: body.jobId, itemId: body.itemId }));
    return;
  }

  const attempts = Number(item.attempts) + 1;
  await markItemProcessing(env, item, attempts);
  await refreshJobCounts(env, body.jobId);

  try {
    const mode: AsyncStorageMode = body.mode ?? "md-only";
    const article = await fetchAndConvertArticle(body.url, fetcher);
    if (mode === "full" && article.images.length > 0) {
      const cloudImages = await Promise.all(
        article.images.map((imageUrl) => storeImageAsset(env, item, imageUrl, body.url, fetcher))
      );
      article.cloudImages = cloudImages;
      article.imageMap = Object.fromEntries(
        cloudImages
          .filter((image) => image.url)
          .map((image) => [image.originalUrl, image.url as string])
      );
    }
    await markItemSucceeded(env, item, article, mode);
    await refreshJobCounts(env, body.jobId);
  } catch (error) {
    const message = errorMessage(error);
    if (attempts < body.maxAttempts) {
      await markItemQueuedForRetry(env, item, message);
      await refreshJobCounts(env, body.jobId);
      retry(retryDelaySeconds(attempts));
      return;
    }
    await markItemFailed(env, item, message);
    await refreshJobCounts(env, body.jobId);
  }
}
