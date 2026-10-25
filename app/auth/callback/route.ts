import { db } from "@/lib/auth/server";
import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const url = new URL(req.url),
    code = url.searchParams.get("code");
  if (code) {
    const client = await db();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("type") === "recovery"
            ? "/app/settings/account"
            : "/app",
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
