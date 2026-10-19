import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE, verifySessionToken } from "@/lib/siteAuth";

export async function POST(request: NextRequest) {
  const secret = process.env.SITE_PASSWORD_HASH;
  if (!secret || !await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret)) return NextResponse.json({ error: "Interne toegang vereist." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(`${secret}:studio-customer`), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_MAX_AGE });
  return response;
}
