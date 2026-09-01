import { NextResponse } from "next/server";
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth/session";

export async function POST(req: Request) {
  const authPassword = process.env.AUTH_PASSWORD;
  if (!authPassword) {
    return NextResponse.json({ error: "AUTH_PASSWORD not configured on the server" }, { status: 503 });
  }

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !passwordMatches(password, authPassword)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  return res;
}
