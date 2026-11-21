import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Crockford base32 alphabet: no I, L, O, U → easy to read aloud and type. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Human-typable random code, e.g. "7KQ2M-X9DPA" (10 symbols × 5 bits = 50 bits of entropy).
 * Combined with expiry, use limits and rate limiting this is not practically guessable.
 */
export function randomHumanCode(length = 10, groupSize = 5): string {
  let raw = '';
  for (let i = 0; i < length; i++) raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return raw.match(new RegExp(`.{1,${groupSize}}`, 'g'))!.join('-');
}

/** Normalises user input: upper-case, strips separators/whitespace, maps look-alikes. */
export function normalizeHumanCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}
