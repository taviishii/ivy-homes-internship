import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { unsaveListing } from "@/lib/ivy/saved";
import { IvyApiError } from "@/lib/ivy/client";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAccessToken();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { id } = await params;
  try {
    await unsaveListing(session.token, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof IvyApiError ? err.status : 500;
    return NextResponse.json({ error: "Failed to remove saved listing" }, { status });
  }
}
