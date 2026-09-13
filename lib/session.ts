// Server Component / Route Handler side of session management. Reading a
// cookie is allowed during Server Component rendering; writing one is not
// (Next.js only allows cookie writes from a Route Handler or Server
// Function) — so the automatic-refresh-before-expiry logic lives in
// proxy.ts, which runs before any of these and can rewrite the cookie on
// its way through. By the time code here runs, the cookie is already fresh.
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  deserializeSession,
  serializeSession,
  type SessionData,
} from "./session-shared";
import { ivyLogin, ivyLogout, type IvyLoginResponse } from "./ivy/auth";

function toSessionData(email: string, login: IvyLoginResponse): SessionData {
  return {
    accessToken: login.access_token,
    refreshToken: login.refresh_token,
    expiresAt: Date.now() + login.expires_in * 1000,
    email,
  };
}

/** Call from a Route Handler only (login endpoint). */
export async function loginAndCreateSession(
  email: string,
  password: string
): Promise<{ email: string }> {
  const login = await ivyLogin(email, password);
  const store = await cookies();
  const cookieValue = await serializeSession(toSessionData(email, login));
  store.set(SESSION_COOKIE_NAME, cookieValue, SESSION_COOKIE_OPTIONS);
  return { email: login.user.email };
}

/** Call from a Route Handler only (logout endpoint). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const session = await deserializeSession(store.get(SESSION_COOKIE_NAME)?.value);
  if (session) {
    await ivyLogout(session.accessToken);
  }
  store.delete(SESSION_COOKIE_NAME);
}

/** Safe to call from Server Components, Route Handlers, anywhere server-side. */
export async function readSession(): Promise<SessionData | null> {
  const store = await cookies();
  return deserializeSession(store.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * The access token for the current request, already refreshed by proxy.ts
 * if it was close to expiring. Returns null if there's no logged-in user.
 */
export async function getAccessToken(): Promise<{
  token: string;
  email: string;
} | null> {
  const session = await readSession();
  if (!session) return null;
  return { token: session.accessToken, email: session.email };
}
