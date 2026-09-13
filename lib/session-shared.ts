// Pure helpers shared between lib/session.ts (Server Components / Route
// Handlers, via next/headers cookies()) and proxy.ts (via NextRequest /
// NextResponse cookies). Uses only Web Crypto (`crypto.subtle`), which is
// available in both the Node.js runtime and the Edge runtime proxy.ts may
// run under, so this file works in either without a runtime-specific import.
//
// The session cookie is encrypted, not just HttpOnly. The Ivy API's own
// access_token JWT embeds the literal IVY_API_KEY as an internal claim
// (verified by decoding a real token during investigation — see
// analysis/INVESTIGATION_LOG.md). An HttpOnly cookie still ships that JWT's
// bytes to the browser and is visible in the browser's own devtools cookie
// inspector (just not to page JavaScript) — enough for a curious user to
// base64-decode it and recover the shared API key. Encrypting the cookie
// payload with a key derived from IVY_API_KEY keeps that value from ever
// appearing in a form the browser can read, while staying fully stateless
// (no server-side session store, so it works the same in a single process
// or across many serverless instances).

export const SESSION_COOKIE_NAME = "ivy_session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
/** Refresh once fewer than this many ms remain on the 900s access token. */
export const REFRESH_SKEW_MS = 60_000;

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
  email: string;
}

let cachedKey: Promise<CryptoKey> | null = null;

function getSessionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = process.env.IVY_API_KEY;
  if (!secret) throw new Error("IVY_API_KEY is not set");

  cachedKey = (async () => {
    const material = new TextEncoder().encode(`ivy-homes-session-key:${secret}`);
    const digest = await crypto.subtle.digest("SHA-256", material);
    return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  })();
  return cachedKey;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function serializeSession(session: SessionData): Promise<string> {
  const key = await getSessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(session));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return toBase64Url(combined);
}

export async function deserializeSession(value: string | undefined | null): Promise<SessionData | null> {
  if (!value) return null;
  try {
    const key = await getSessionKey();
    const combined = fromBase64Url(value);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext));
    if (
      typeof parsed?.accessToken === "string" &&
      typeof parsed?.refreshToken === "string" &&
      typeof parsed?.expiresAt === "number" &&
      typeof parsed?.email === "string"
    ) {
      return parsed as SessionData;
    }
    return null;
  } catch {
    return null; // tampered, expired key derivation input, or garbage cookie
  }
}

export function isExpiringSoon(session: SessionData): boolean {
  return Date.now() >= session.expiresAt - REFRESH_SKEW_MS;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
};
