import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** A random, URL-safe token. 22 characters gives about 128 bits, which can't be guessed. */
export function newToken(length = 22): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Only hashes of tokens are stored, so a database leak doesn't hand out working links. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
