export const SESSION_COOKIE = "tinkr_session";
export const SESSION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();

function hmacKey(secret: string, usage: KeyUsage) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

const toHex = (bytes: ArrayBuffer) => Buffer.from(bytes).toString("hex");

async function sign(secret: string, value: string) {
  return crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), encoder.encode(value));
}

/** A cookie value that proves login until it expires, signed so it can't be forged. */
export async function createSession(secret: string, now = Date.now()) {
  const expires = String(now + SESSION_DAYS * DAY_MS);
  return `${expires}.${toHex(await sign(secret, expires))}`;
}

export async function validSession(token: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!token || !secret) return false;
  const [expires, signature, ...rest] = token.split(".");
  if (rest.length || !/^\d+$/.test(expires ?? "") || !/^[0-9a-f]{64}$/.test(signature ?? "")) return false;
  if (Number(expires) <= now) return false;
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    Buffer.from(signature, "hex"),
    encoder.encode(expires),
  );
}

/** Compares in constant time, so response timing reveals nothing about the password. */
export async function passwordMatches(given: string, password: string | undefined, secret: string | undefined) {
  if (!password || !secret) return false;
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    await sign(secret, password),
    encoder.encode(given),
  );
}
