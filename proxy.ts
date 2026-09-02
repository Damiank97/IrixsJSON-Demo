import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/siteAuth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth/login") return NextResponse.next();

  const expectedHash = process.env.SITE_PASSWORD_HASH;

  if (!expectedHash) {
    return new NextResponse("De Toolbox-beveiliging is nog niet geconfigureerd.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(session, expectedHash)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Inloggen vereist." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
