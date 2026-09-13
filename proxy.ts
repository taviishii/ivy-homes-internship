// Next.js 16 renamed middleware.ts -> proxy.ts (same mechanism, new name).
// This is the ONLY place that writes the session cookie's refresh, because
// Server Components are not allowed to set cookies — see lib/session.ts.
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  deserializeSession,
  serializeSession,
  isExpiringSoon,
  type SessionData,
} from "@/lib/session-shared";

// Paths that work whether or not the user is logged in.
const BYPASS_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

async function tryRefresh(session: SessionData): Promise<SessionData | null> {
  const apiKey = process.env.IVY_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.IVY_API_BASE_URL || "https://solve.ivy.homes";
  try {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      email: session.email,
    };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const bypass = BYPASS_PATHS.has(pathname);

  let session = await deserializeSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const response = NextResponse.next();

  if (session && isExpiringSoon(session)) {
    const refreshed = await tryRefresh(session);
    if (refreshed) {
      session = refreshed;
      response.cookies.set(SESSION_COOKIE_NAME, await serializeSession(refreshed), SESSION_COOKIE_OPTIONS);
    } else {
      session = null;
      response.cookies.delete(SESSION_COOKIE_NAME);
    }
  }

  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/listings", request.url));
  }

  if (!session && !bypass) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
