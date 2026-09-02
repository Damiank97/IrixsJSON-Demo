import { type NextRequest, NextResponse } from "next/server";

const AUTH_USER = "irixs";
const AUTH_SALT = "irixs-toolbox-basic-auth-v1:";

export async function proxy(request: NextRequest) {
  const credentials = readBasicCredentials(request.headers.get("authorization"));
  const expectedHash = process.env.SITE_PASSWORD_HASH;

  if (!expectedHash) {
    return new NextResponse("De Toolbox-beveiliging is nog niet geconfigureerd.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (credentials?.username === AUTH_USER) {
    const submittedHash = await sha256(`${AUTH_SALT}${credentials.password}`);
    if (safeEqual(submittedHash, expectedHash)) return NextResponse.next();
  }

  return new NextResponse("Inloggen vereist voor Irixs Toolbox.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Irixs Toolbox", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function readBasicCredentials(header: string | null): { username: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6).trim());
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
