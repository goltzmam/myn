import { NextResponse } from "next/server";
import { publicError } from "@/lib/errors";
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new Error("Forbidden");
}
export function failure(error: unknown) {
  const e = publicError(error);
  return NextResponse.json(
    { error: e.message, code: e.code },
    { status: e.status, headers: { "Cache-Control": "no-store" } },
  );
}
