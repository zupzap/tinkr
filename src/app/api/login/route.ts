import { cookies } from "next/headers";
import { createLimiter, fromOwnSite } from "@/lib/guard";
import { createSession, passwordMatches, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";
import { SITES } from "@/lib/sites";

const allow = createLimiter({ perMinute: 5, perDay: 50, everyonePerDay: 1000 });

export async function POST(req: Request) {
  if (!fromOwnSite(req.headers.get("origin"), req.headers.get("host"), SITES)) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }
  const visitor = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!allow(visitor)) return Response.json({ error: "Too many tries. Wait a minute." }, { status: 429 });

  const secret = process.env.SESSION_SECRET;
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const given = String(body?.password ?? "").slice(0, 200);
  if (!secret || !(await passwordMatches(given, process.env.ACCESS_PASSWORD, secret))) {
    return Response.json({ error: "That's not it." }, { status: 401 });
  }

  (await cookies()).set(SESSION_COOKIE, await createSession(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return Response.json({ ok: true });
}
