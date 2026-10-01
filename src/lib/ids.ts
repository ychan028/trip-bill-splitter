// No 0/O, 1/I/L to avoid misreading when typed from a screen.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function randomCode(len = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  // 256 % 31 != 0 gives a slight bias; irrelevant at 10 chars for an invite code.
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

export function randomId(): string {
  return randomCode(16).toLowerCase();
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function formatCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}
