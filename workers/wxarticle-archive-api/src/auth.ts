const encoder = new TextEncoder();

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(value));
}

function equalFixedLength(left: ArrayBuffer, right: ArrayBuffer): boolean {
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

export async function verifyApiKey(request: Request, expected: string): Promise<boolean> {
  const provided = request.headers.get("X-API-Key") ?? "";
  const [providedHash, expectedHash] = await Promise.all([sha256(provided), sha256(expected)]);
  return equalFixedLength(providedHash, expectedHash);
}
