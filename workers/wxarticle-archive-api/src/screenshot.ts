import type { BrowserQuickAction, ScreenshotOptions } from "./types";

const DEFAULT_WIDTH = 1365;
const DEFAULT_HEIGHT = 768;
const MIN_WIDTH = 320;
const MAX_WIDTH = 1920;
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 3000;

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower === "::1" ||
    lower === "[::1]" ||
    lower.includes(":") ||
    isPrivateIpv4(lower)
  );
}

export function parsePublicHttpsUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("url must be a string");
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("url must be a valid public HTTPS URL");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error("Only public HTTPS URLs are allowed");
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("Private, local, and loopback URLs are not allowed");
  }
  return parsed.toString();
}

export function parseScreenshotOptions(value: unknown): ScreenshotOptions {
  const options = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    width: clampNumber(options.width, DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH),
    height: clampNumber(options.height, DEFAULT_HEIGHT, MIN_HEIGHT, MAX_HEIGHT),
    fullPage: typeof options.fullPage === "boolean" ? options.fullPage : true
  };
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const clean = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function quickActionImage(response: Response): Promise<ArrayBuffer> {
  if (!response.ok) {
    response.body?.cancel();
    throw new Error(`Browser Run screenshot failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("json")) {
    return response.arrayBuffer();
  }
  const parsed = (await response.json()) as {
    result?: { screenshot?: unknown };
    screenshot?: unknown;
  };
  const screenshot = parsed.result?.screenshot ?? parsed.screenshot;
  if (typeof screenshot !== "string") {
    throw new Error("Browser Run screenshot response did not include an image");
  }
  return base64ToArrayBuffer(screenshot);
}

export async function captureScreenshot(
  browser: BrowserQuickAction | undefined,
  url: string,
  options: ScreenshotOptions
): Promise<ArrayBuffer> {
  if (!browser) {
    throw new Error("Browser Run binding is not configured");
  }
  const response = await browser.quickAction("screenshot", {
    url,
    viewport: {
      width: options.width,
      height: options.height
    },
    screenshotOptions: {
      fullPage: options.fullPage,
      type: "png"
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
      timeout: 30000
    }
  });
  return quickActionImage(response);
}

export function screenshotImageResponse(image: ArrayBuffer): Response {
  return new Response(image, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store"
    }
  });
}
