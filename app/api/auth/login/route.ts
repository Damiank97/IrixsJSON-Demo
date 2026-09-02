import { NextResponse } from "next/server";
import {
  createSessionToken,
  hashPassword,
  safeEqual,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/siteAuth";

export async function POST(request: Request) {
  const expectedHash = process.env.SITE_PASSWORD_HASH;
  if (!expectedHash) {
    return NextResponse.json({ error: "De beveiliging is nog niet geconfigureerd." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const submittedHash = await hashPassword(password);

  if (!safeEqual(submittedHash, expectedHash)) {
    return NextResponse.json({ error: "Dat wachtwoord klopt niet." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(expectedHash), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
