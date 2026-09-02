export const SESSION_COOKIE = "irixs_toolbox_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const AUTH_SALT = "irixs-toolbox-basic-auth-v1:";
const TOKEN_VERSION = "v1";

export async function hashPassword(password: string): Promise<string> {
  return sha256(`${AUTH_SALT}${password}`);
}

export async function createSessionToken(secretHash: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${TOKEN_VERSION}.${expiresAt}`;
  return `${payload}.${await sign(payload, secretHash)}`;
}

export async function verifySessionToken(token: string | undefined, secretHash: string): Promise<boolean> {
  if (!token) return false;
  const [version, expiresAtText, signature, extra] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if (extra || version !== TOKEN_VERSION || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = await sign(`${version}.${expiresAtText}`, secretHash);
  return safeEqual(signature, expected);
}

export function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(digest);
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
