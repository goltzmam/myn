import "server-only";
import { randomUUID } from "node:crypto";
import { sign } from "@/worker/protocol.mjs";
import { observationSchema, type Action, type Task } from "./schema";
import { AppError } from "@/lib/errors";
export function executionAvailable() {
  return Boolean(
    process.env.MYN_WORKER_URL &&
    process.env.MYN_WORKER_SECRET &&
    process.env.MYN_WORKER_SECRET.length >= 32,
  );
}
export async function browserCommand(
  task: Task,
  operation: "observe" | "execute" | "close",
  signal?: AbortSignal,
  action?: Action,
) {
  if (!executionAvailable())
    throw new AppError(
      "EXECUTION_UNAVAILABLE",
      503,
      "Browser actions are not connected yet. You can continue with Guide me.",
    );
  const url = new URL(process.env.MYN_WORKER_URL!);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new AppError(
      "EXECUTION_UNAVAILABLE",
      503,
      "The browser service needs a secure connection.",
    );
  const token = sign(
    {
      operation,
      action,
      taskId: task.id,
      userId: task.user_id,
      sessionId: task.execution_id,
      domains: task.domains,
      nonce: randomUUID(),
      expires: Date.now() + 30000,
    },
    process.env.MYN_WORKER_SECRET!,
  );
  const response = await fetch(new URL("/v1/command", url), {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    signal: AbortSignal.any([
      AbortSignal.timeout(25000),
      ...(signal ? [signal] : []),
    ]),
  });
  if (!response.ok)
    throw new AppError(
      "BROWSER_ACTION_FAILED",
      409,
      "The browser action was blocked or interrupted. Review the page before trying again.",
    );
  const result = await response.json();
  return operation === "close"
    ? null
    : observationSchema.parse(result.observation);
}
