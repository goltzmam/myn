import { z } from "zod";
import { identity } from "@/lib/auth/server";
import { failure, sameOrigin } from "@/lib/security";
import { checkDatabase, AppError } from "@/lib/errors";
import {
  loadTask,
  updateTask,
  planTask,
  controlTask,
  advanceTask,
  verifyTaskStep,
  closeExecution,
  actionHash,
} from "@/lib/agent/server";
import { executionAvailable } from "@/lib/agent/browser";
import { modeSchema } from "@/lib/agent/schema";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
async function auth(ctx: Context) {
  const { client, user } = await identity();
  const { id } = await ctx.params;
  return {
    client,
    user,
    task: await loadTask(client, z.string().uuid().parse(id), user.id),
  };
}
export async function GET(_req: Request, ctx: Context) {
  try {
    const { task } = await auth(ctx);
    return Response.json(
      {
        task,
        actionHash: task.pending_action
          ? actionHash(task.pending_action)
          : null,
        executionAvailable: executionAvailable(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
const schema = z
  .object({
    command: z.enum([
      "plan",
      "mode",
      "pause",
      "resume",
      "cancel",
      "revoke",
      "grant",
      "advance",
      "approve",
      "confirm",
      "verify",
      "amend",
    ]),
    version: z.number().int().min(0),
    mode: modeSchema.optional(),
    domains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/),
      )
      .min(1)
      .max(8)
      .optional(),
    approval: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    evidence: z.string().trim().min(3).max(500).optional(),
    image: z
      .string()
      .max(600000)
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
      .optional(),
    steps: z
      .array(
        z
          .object({
            title: z.string().trim().min(3).max(160),
            success: z.string().trim().min(3).max(400),
          })
          .strict(),
      )
      .min(1)
      .max(8)
      .optional(),
  })
  .strict();
export async function POST(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    if (Number(req.headers.get("content-length")) > 650000)
      throw new AppError("INVALID_REQUEST", 400, "The request is too large.");
    const body = schema.parse(await req.json());
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(45000)]);
    const { client, task } = await auth(ctx);
    if (
      body.version !== task.version &&
      !["pause", "cancel", "revoke", "mode"].includes(body.command)
    )
      throw new AppError(
        "TASK_CONFLICT",
        409,
        "The task changed. Refresh before continuing.",
      );
    let next = task,
      observation;
    if (body.command === "plan") next = await planTask(client, task, signal);
    else if (
      ["pause", "resume", "cancel", "revoke", "mode"].includes(body.command)
    ) {
      if (body.command === "mode" && !body.mode)
        throw new AppError("INVALID_REQUEST", 400, "Choose a mode.");
      next = await controlTask(
        client,
        task,
        body.command as "pause" | "resume" | "cancel" | "revoke" | "mode",
        body.mode,
      );
    } else if (body.command === "grant") {
      if (!executionAvailable())
        throw new AppError(
          "EXECUTION_UNAVAILABLE",
          503,
          "Browser actions are not connected yet. Continue with Guide me.",
        );
      if (!body.domains)
        throw new AppError(
          "INVALID_REQUEST",
          400,
          "Choose the allowed websites.",
        );
      // Close old browser scope before granting a different set of destinations.
      await closeExecution(client, task);
      const { data, error } = await client.rpc("agent_grant", {
        p_id: task.id,
        p_version: task.version,
        p_domains: body.domains,
      });
      checkDatabase(error);
      next = data;
    } else if (body.command === "advance" || body.command === "approve") {
      const result = await advanceTask(
        client,
        task,
        signal,
        body.command === "approve" ? body.approval : undefined,
      );
      next = result.task;
      observation = result.observation;
    } else if (body.command === "confirm" || body.command === "verify") {
      if (body.command === "confirm" && !body.evidence)
        throw new AppError(
          "VERIFICATION_REQUIRED",
          400,
          "Describe the result you confirmed.",
        );
      if (body.command === "verify" && !body.image)
        throw new AppError(
          "VERIFICATION_REQUIRED",
          400,
          "Share the current screen to verify this step.",
        );
      next = await verifyTaskStep(
        client,
        task,
        body.command === "confirm"
          ? { evidence: body.evidence }
          : { image: body.image },
        signal,
      );
    } else if (body.command === "amend") {
      if (!body.steps || task.state !== "WAITING_FOR_USER")
        throw new AppError(
          "TASK_CONFLICT",
          409,
          "Pause the task to update its remaining steps.",
        );
      const verified = task.plan.slice(0, task.step_index);
      if (verified.length + body.steps.length > 8)
        throw new AppError(
          "INVALID_REQUEST",
          400,
          "Keep the plan to eight steps or fewer.",
        );
      next = await updateTask(
        client,
        task,
        {
          plan: [
            ...verified,
            ...body.steps.map((s) => ({ ...s, status: "pending" })),
          ],
          pending_action: null,
        },
        "plan_amended",
      );
    }
    return Response.json(
      {
        task: next,
        observation,
        actionHash: next.pending_action
          ? actionHash(next.pending_action)
          : null,
        executionAvailable: executionAvailable(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    const { client, task } = await auth(ctx);
    await closeExecution(client, task);
    const { error } = await client.rpc("agent_delete", { p_id: task.id });
    checkDatabase(error);
    return Response.json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
