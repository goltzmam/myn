import { NextResponse } from "next/server";
import { publicError } from "@/lib/errors";
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const expected = new URL(req.url);
  const host = req.headers.get("host");
  if (host) expected.host = host;
  try {
    if (new URL(origin).origin !== expected.origin)
      throw new Error("Forbidden");
  } catch {
    throw new Error("Forbidden");
  }
}
export function failure(error: unknown, details: Record<string, unknown> = {}) {
  const e = publicError(error);
  return NextResponse.json(
    { error: e.message, code: e.code, ...details },
    { status: e.status, headers: { "Cache-Control": "no-store" } },
  );
}
