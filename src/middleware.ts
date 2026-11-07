import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, validSession } from "@/lib/session";

/** Everything needs a login except the login page itself. */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await validSession(token, process.env.SESSION_SECRET)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"],
};
