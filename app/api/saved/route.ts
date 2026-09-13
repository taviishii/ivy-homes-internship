import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { getSaved, saveListing } from "@/lib/ivy/saved";
import { IvyApiError } from "@/lib/ivy/client";

export async function GET() {
  const session = await getAccessToken();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  try {
    const saved = await getSaved(session.token);
    return NextResponse.json(saved);
  } catch (err) {
    const status = err instanceof IvyApiError ? err.status : 500;
    return NextResponse.json({ error: "Failed to load saved listings" }, { status });
  }
}

export async function POST(request: Request) {
  const session = await getAccessToken();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const listingId = body?.listingId;
  if (typeof listingId !== "string" || !listingId) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }

  try {
    await saveListing(session.token, listingId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof IvyApiError ? err.status : 500;
    return NextResponse.json({ error: "Failed to save listing" }, { status });
  }
}
