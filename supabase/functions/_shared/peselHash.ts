export function normalizePesel(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  if (!hasValidPeselChecksum(digits)) return null;
  return digits;
}

export function hasValidPeselChecksum(digits: string): boolean {
  if (digits.length !== 11 || !/^\d{11}$/.test(digits)) return false;
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(digits[index]) * weights[index];
  }
  const checksum = (10 - (sum % 10)) % 10;
  return checksum === Number(digits[10]);
}

export async function hashPeselSha256(
  pesel: string,
  salt: string,
): Promise<string> {
  const encoded = new TextEncoder().encode(`${salt}:${pesel}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
