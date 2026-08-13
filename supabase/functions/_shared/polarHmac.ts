/** Polar AccessLink HMAC (header Polar-Webhook-Signature). */

export function hexFromBytes(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function bytesFromHex(hex: string): Uint8Array | null {
  const normalized = hex.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length % 2 !== 0) {
    return null;
  }
  if (!/^[0-9a-f]+$/.test(normalized)) {
    return null;
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function hmacSha256Hex(
  secret: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return hexFromBytes(new Uint8Array(signature));
}

export function timingSafeEqualHex(left: string, right: string): boolean {
  const leftBytes = bytesFromHex(left);
  const rightBytes = bytesFromHex(right);
  if (leftBytes === null || rightBytes === null) {
    return false;
  }
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < leftBytes.length; i += 1) {
    mismatch |= leftBytes[i] ^ rightBytes[i];
  }
  return mismatch === 0;
}

export async function verifyPolarWebhookSignature(
  rawBody: string,
  headerSignature: string | null,
  secret: string,
): Promise<boolean> {
  if (!headerSignature || secret.length === 0) {
    return false;
  }
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqualHex(expected, headerSignature);
}
