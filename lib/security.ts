import { NextResponse } from "next/server";
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new Error("Forbidden");
}
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message === "Unauthorized"
      ? 401
      : message === "Forbidden"
        ? 403
        : message.includes("limit")
          ? 429
          : message.includes("Configure")
            ? 503
            : 400;
  return NextResponse.json(
    {
      error:
        message.startsWith("Configure") ||
        ["Unauthorized", "Forbidden"].includes(message) ||
        message.includes("limit")
          ? message
          : "Request failed. Check configuration and retry.",
    },
    { status },
  );
}
