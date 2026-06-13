export const DEFAULT_MAX_ATTEMPTS = 4;
export const MAX_URLS_PER_JOB = 100;
export const MAX_REQUEST_BYTES = 256 * 1024;
export const MAX_HTML_BYTES = 8 * 1024 * 1024;

export type ItemStatus = "queued" | "processing" | "succeeded" | "failed";
export type JobStatus = "queued" | "processing" | "succeeded" | "failed" | "partial_failed";
export type StorageMode = "inline" | "md-only" | "full";
export type AsyncStorageMode = Exclude<StorageMode, "inline">;

export interface QueueMessageBody {
  jobId: string;
  itemId: string;
  url: string;
  maxAttempts: number;
  mode?: AsyncStorageMode;
}

export interface CloudImageResult {
  originalUrl: string;
  key?: string;
  url?: string;
  contentType?: string;
  error?: string;
}

export interface ArticleResult {
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  markdown: string;
  images: string[];
  cloudImages?: CloudImageResult[];
  imageMap?: Record<string, string>;
  sourceFetchedAt: string;
}

export interface JobRow {
  job_id: string;
  mode?: AsyncStorageMode;
  status: JobStatus;
  total: number;
  queued: number;
  processing: number;
  succeeded: number;
  failed: number;
  created_at: string;
  updated_at: string;
}

export interface ItemRow {
  job_id: string;
  item_id: string;
  url: string;
  status: ItemStatus;
  attempts: number;
  max_attempts: number;
  error: string | null;
  result_key: string | null;
  result_kind?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRow {
  job_id: string;
  item_id: string;
  original_url: string;
  asset_key: string | null;
  content_type: string | null;
  error: string | null;
  created_at: string;
}

export interface CountRow {
  status: ItemStatus;
  count: number;
}

export interface JobItemResponse {
  itemId: string;
  url: string;
  status: ItemStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  resultKind?: string;
  resultUrl?: string;
}

export interface JobResponse {
  jobId: string;
  status: JobStatus;
  counts: {
    total: number;
    queued: number;
    processing: number;
    succeeded: number;
    failed: number;
  };
  createdAt: string;
  updatedAt: string;
  mode?: AsyncStorageMode;
  items: JobItemResponse[];
}
