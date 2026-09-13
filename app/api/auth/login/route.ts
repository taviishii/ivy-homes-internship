import { NextResponse } from "next/server";
import { loginAndCreateSession } from "@/lib/session";
import { IvyApiError } from "@/lib/ivy/client";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password } = body;
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    const session = await loginAndCreateSession(email, password);
    return NextResponse.json({ email: session.email });
  } catch (err) {
    if (err instanceof IvyApiError) {
      const message =
        typeof err.detail === "string" ? err.detail : "Invalid email or password";
      return NextResponse.json({ error: message }, { status: err.status });
    }
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
