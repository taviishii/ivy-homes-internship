import { NextResponse } from "next/server";

// A no-op endpoint. Its only purpose is to be a request that passes through
// proxy.ts, which transparently refreshes the session cookie if the access
// token is close to expiring — see components/SessionKeepAlive.tsx.
export async function POST() {
  return NextResponse.json({ ok: true });
}
