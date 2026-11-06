import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, checkDatabase, publicError } from "@/lib/errors";
import { reserve, context } from "@/lib/sessions/server";
import { agentProvider } from "./provider";
import { browserCommand, executionAvailable } from "./browser";
import {
  assertTransition,
  completeStep,
  canComplete,
  modeState,
  needsApproval,
  safeTaskError,
  verifyObservation,
} from "./core";
import { actionSchema, type Mode, type Task, type TaskState } from "./schema";
type Client = SupabaseClient;
export function actionHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export async function loadTask(
  client: Client,
  id: string,
  userId: string,
): Promise<Task> {
  const { data, error } = await client
    .from("agent_tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  checkDatabase(error);
  if (!data) throw new Error("Forbidden");
  return data as Task;
}
export async function updateTask(
  client: Client,
  task: Task,
  patch: Record<string, unknown>,
  event: string,
): Promise<Task> {
  if (patch.state) assertTransition(task.state, patch.state as TaskState);
  const { data, error } = await client.rpc("agent_update", {
    p_id: task.id,
    p_version: task.version,
    p_patch: patch,
    p_event: event,
  });
  if (error?.message?.includes("conflict"))
    throw new AppError(
      "TASK_CONFLICT",
      409,
      "The task changed. Refresh before continuing.",
    );
  checkDatabase(error);
  return data as Task;
}
async function record(client: Client, task: Task, kind: string, data: unknown) {
  const { error } = await client.rpc("agent_record", {
    p_id: task.id,
    p_kind: kind,
    p_data: data,
  });
  checkDatabase(error);
}
export async function planTask(
  client: Client,
  task: Task,
  signal: AbortSignal,
): Promise<Task> {
  const planning = await updateTask(
    client,
    task,
    { state: "PLANNING", error: null, pending_action: null },
    "planning",
  );
  try {
    await reserve(client, task.session_id, "analysis");
    const started = Date.now();
    const memory = await context(client, {
      id: task.session_id,
      objective: task.objective,
    });
    const result = await agentProvider().plan(
      task.objective,
      memory.history,
      signal,
    );
    await record(client, planning, "usage", {
      operation: "plan",
      tokens: result.tokens,
      duration_ms: Date.now() - started,
    });
    return await updateTask(
      client,
      planning,
      {
        state: modeState(task.mode),
        summary: result.plan.summary,
        domains: result.plan.domains,
        plan: result.plan.steps.map((s) => ({ ...s, status: "pending" })),
        step_index: 0,
        attempts: 0,
      },
      "planned",
    );
  } catch (e) {
    const latest = await loadTask(client, task.id, task.user_id);
    if (latest.version === planning.version)
      await updateTask(
        client,
        planning,
        { state: "FAILED", error: publicError(e).message },
        "planning_failed",
      );
    throw e;
  }
}
export async function closeExecution(client: Client, task: Task) {
  const { error } = await client.rpc("agent_revoke", { p_id: task.id });
  checkDatabase(error);
  if (task.execution_id) await browserCommand(task, "close").catch(() => {});
}
export async function controlTask(
  client: Client,
  task: Task,
  command: "pause" | "cancel" | "resume" | "mode" | "revoke",
  mode?: Mode,
) {
  if (["CANCELLED", "COMPLETED"].includes(task.state))
    throw new AppError("TASK_TERMINAL", 409, "This task is already finished.");
  const target =
    command === "cancel"
      ? "CANCELLED"
      : command === "resume"
        ? modeState(task.mode)
        : "WAITING_FOR_USER";
  // First invalidate in-flight results, then close browser sessions and revoke grants.
  const next = await updateTask(
    client,
    task,
    {
      state: target,
      mode: mode || task.mode,
      pending_action: null,
      run_id: null,
      lease_until: null,
      execution_id: null,
      observation_hash: null,
      error: null,
    },
    command,
  );
  await closeExecution(client, task);
  return next;
}
export async function verifyTaskStep(
  client: Client,
  task: Task,
  input: { evidence?: string; image?: string },
  signal: AbortSignal,
) {
  if (!["WAITING_FOR_USER", "WAITING_FOR_PERMISSION"].includes(task.state))
    throw new AppError(
      "TASK_CONFLICT",
      409,
      "Pause this task before verifying the step.",
    );
  if (!task.plan[task.step_index])
    throw new AppError("VERIFICATION_REQUIRED", 409, "Create a plan first.");
  // Permission-wait -> user-wait -> verifying is deliberate; verification never grants execution.
  let current = task;
  if (current.state === "WAITING_FOR_PERMISSION")
    current = await updateTask(
      client,
      current,
      { state: "WAITING_FOR_USER" },
      "user_verification",
    );
  current = await updateTask(
    client,
    current,
    { state: "VERIFYING" },
    "verifying",
  );
  try {
    let evidence = input.evidence || "",
      source: "user" | "screen" = "user";
    if (input.image) {
      await reserve(client, task.session_id, "analysis");
      const start = Date.now(),
        result = await agentProvider().verify(task, input.image, signal);
      await record(client, current, "usage", {
        operation: "screen_verify",
        tokens: result.tokens,
        duration_ms: Date.now() - start,
      });
      if (!result.matched || result.evidence.trim().length < 3)
        return await updateTask(
          client,
          current,
          {
            state: "WAITING_FOR_USER",
            error:
              "The current screen does not clearly verify this step. Share the relevant result or confirm it yourself.",
          },
          "verification_not_matched",
        );
      evidence = result.evidence;
      source = "screen";
    }
    const plan = completeStep(task.plan, task.step_index, evidence, source);
    await record(client, current, "verification", {
      step_index: task.step_index,
      source,
      evidence,
    });
    const finished = await updateTask(
      client,
      current,
      {
        plan,
        step_index: task.step_index + 1,
        state: canComplete(plan) ? "COMPLETED" : modeState(task.mode),
        attempts: 0,
        pending_action: null,
        error: null,
      },
      "step_verified",
    );
    if (finished.state === "COMPLETED") await closeExecution(client, finished);
    return finished;
  } catch (e) {
    const latest = await loadTask(client, task.id, task.user_id);
    if (latest.version === current.version)
      await updateTask(
        client,
        current,
        { state: "WAITING_FOR_USER", error: publicError(e).message },
        "verification_failed",
      );
    throw e;
  }
}
async function permission(client: Client, task: Task) {
  const { data, error } = await client
    .from("agent_permissions")
    .select("domains,expires_at")
    .eq("task_id", task.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  checkDatabase(error);
  if (
    !data?.[0] ||
    JSON.stringify(data[0].domains) !== JSON.stringify(task.domains)
  )
    throw new AppError(
      "PERMISSION_REQUIRED",
      403,
      "Approve the allowed websites before opening an isolated browser.",
    );
}
export async function advanceTask(
  client: Client,
  task: Task,
  signal: AbortSignal,
  approval?: string,
) {
  if (!executionAvailable())
    throw new AppError(
      "EXECUTION_UNAVAILABLE",
      503,
      "Browser actions are not connected yet. You can continue with Guide me.",
    );
  if (
    task.mode === "guide" ||
    !["WAITING_FOR_PERMISSION", "RUNNING"].includes(task.state)
  )
    throw new AppError(
      "TASK_CONFLICT",
      409,
      "Resume an execution mode before continuing.",
    );
  if (!task.plan[task.step_index])
    throw new AppError("VERIFICATION_REQUIRED", 409, "Create a plan first.");
  if (task.attempts >= 2)
    throw new AppError(
      "TASK_RETRY_LIMIT",
      409,
      "Automatic retries stopped. Review the result and continue with guidance.",
    );
  await permission(client, task);
  const { count, error: countError } = await client
    .from("agent_tool_executions")
    .select("id", { count: "exact", head: true })
    .eq("task_id", task.id);
  checkDatabase(countError);
  if ((count || 0) >= 50)
    throw new AppError(
      "TASK_ACTION_LIMIT",
      429,
      "This task reached its action limit. Review the progress with guidance.",
    );
  if (task.state === "RUNNING") {
    const { data, error } = await client
      .from("agent_tasks")
      .select("lease_until")
      .eq("id", task.id)
      .single();
    checkDatabase(error);
    if (data?.lease_until && Date.parse(data.lease_until) > Date.now())
      throw new AppError("TASK_BUSY", 409, "An action is already in progress.");
  }
  if (
    task.pending_action?.action &&
    needsApproval(task.pending_action.action)
  ) {
    if (approval !== actionHash(task.pending_action))
      throw new AppError(
        "ACTION_APPROVAL_REQUIRED",
        403,
        "Review and approve this exact action first.",
      );
  }
  let current = await updateTask(
    client,
    task,
    {
      state: "RUNNING",
      run_id: randomUUID(),
      lease_until: new Date(Date.now() + 60000).toISOString(),
      execution_id: task.execution_id || randomUUID(),
      error: null,
    },
    "run_started",
  );
  try {
    if (!task.execution_id)
      await record(client, current, "execution", { id: current.execution_id });
    let observation = await browserCommand(current, "observe", signal);
    if (!observation) throw new Error("Browser unavailable");
    if (
      task.pending_action?.action &&
      needsApproval(task.pending_action.action) &&
      task.pending_action.observationHash !==
        actionHash({
          url: observation.url,
          text: observation.text,
          targets: observation.targets,
        })
    )
      throw new AppError(
        "ACTION_STALE",
        409,
        "The page changed since this action was proposed. Review a new action before continuing.",
      );
    const observationHash = actionHash({
      url: observation.url,
      text: observation.text,
      targets: observation.targets,
    });
    if (!task.pending_action && task.observation_hash === observationHash) {
      current = await updateTask(
        client,
        current,
        {
          state: "WAITING_FOR_USER",
          run_id: null,
          lease_until: null,
          error:
            "The page has not changed. Review the current step before continuing.",
        },
        "observation_unchanged",
      );
      return { task: current, observation };
    }
    let decision = task.pending_action;
    if (!decision) {
      await reserve(client, task.session_id, "analysis");
      const start = Date.now(),
        result = await agentProvider().decide(current, observation, signal);
      await record(client, current, "usage", {
        operation: "decide",
        tokens: result.tokens,
        duration_ms: Date.now() - start,
      });
      decision = result.decision;
      if (decision.action) actionSchema.parse(decision.action);
      if (decision.action && needsApproval(decision.action)) {
        current = await updateTask(
          client,
          current,
          {
            state: "WAITING_FOR_PERMISSION",
            observation_hash: observationHash,
            pending_action: {
              ...decision,
              observationHash: actionHash({
                url: observation.url,
                text: observation.text,
                targets: observation.targets,
              }),
            },
            lease_until: null,
            run_id: null,
          },
          "action_proposed",
        );
        return { task: current, observation };
      }
    }
    if (decision.action) {
      await permission(client, current);
      const latest = await loadTask(client, current.id, current.user_id);
      if (latest.version !== current.version || latest.state !== "RUNNING")
        throw new AppError(
          "TASK_CONFLICT",
          409,
          "The task changed before this action could start.",
        );
      const started = Date.now();
      observation = await browserCommand(
        current,
        "execute",
        signal,
        decision.action,
      );
      await record(client, current, "tool", {
        tool: decision.action.type,
        outcome: "executed",
        duration_ms: Date.now() - started,
      });
    }
    if (!observation) throw new Error("Browser unavailable");
    current = await updateTask(
      client,
      current,
      {
        state: "VERIFYING",
        pending_action: null,
        observation_hash: observationHash,
      },
      "verifying_action",
    );
    const evidence = verifyObservation(observation, decision.assertion);
    if (evidence) {
      const plan = completeStep(
        current.plan,
        current.step_index,
        evidence,
        "browser",
      );
      await record(client, current, "verification", {
        step_index: current.step_index,
        source: "browser",
        evidence,
      });
      current = await updateTask(
        client,
        current,
        {
          plan,
          step_index: current.step_index + 1,
          state: canComplete(plan) ? "COMPLETED" : "RUNNING",
          attempts: 0,
          run_id: null,
          lease_until: null,
        },
        "step_verified",
      );
      if (current.state === "COMPLETED") await closeExecution(client, current);
    } else {
      current = await updateTask(
        client,
        current,
        {
          state: decision.action ? "RUNNING" : "WAITING_FOR_USER",
          run_id: null,
          lease_until: null,
          error: decision.action
            ? null
            : "The expected result is not visible. Review the current step or adjust the plan.",
        },
        "result_not_yet_verified",
      );
    }
    return { task: current, observation };
  } catch (e) {
    const latest = await loadTask(client, task.id, task.user_id);
    if (latest.version === current.version) {
      await record(client, current, "tool", {
        tool: task.pending_action?.action?.type || "observe",
        outcome: "failed",
        duration_ms: 0,
      });
      current = await updateTask(
        client,
        current,
        {
          state: current.attempts + 1 >= 2 ? "FAILED" : "WAITING_FOR_USER",
          attempts: current.attempts + 1,
          pending_action: null,
          run_id: null,
          lease_until: null,
          error: safeTaskError(e),
        },
        "action_failed",
      );
      await closeExecution(client, current);
    }
    throw e;
  }
}
