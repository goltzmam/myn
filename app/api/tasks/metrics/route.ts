import { identity } from "@/lib/auth/server";
import { failure } from "@/lib/security";
import { checkDatabase } from "@/lib/errors";
export async function GET() {
  try {
    const { client, user } = await identity();
    const { data: tasks, error } = await client
      .from("agent_tasks")
      .select("id,state,mode,plan,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    checkDatabase(error);
    const ids = (tasks || []).map((t) => t.id);
    if (!ids.length)
      return Response.json(
        { sampleSize: 0 },
        { headers: { "Cache-Control": "no-store" } },
      );
    const [tools, usage, events] = await Promise.all([
      client
        .from("agent_tool_executions")
        .select("outcome,duration_ms")
        .in("task_id", ids)
        .limit(10000),
      client
        .from("agent_usage_metrics")
        .select("tokens,duration_ms,cost_usd")
        .in("task_id", ids)
        .limit(10000),
      client
        .from("agent_events")
        .select("event,mode,task_id")
        .in("task_id", ids)
        .limit(10000),
    ]);
    [tools.error, usage.error, events.error].forEach(checkDatabase);
    const completed = tasks!.filter((t) => t.state === "COMPLETED"),
      finished = tasks!.filter((t) =>
        ["COMPLETED", "FAILED", "CANCELLED"].includes(t.state),
      );
    const verified = completed.filter(
      (t) =>
        Array.isArray(t.plan) &&
        t.plan.every(
          (s: any) => s.status === "completed" && s.evidence?.trim(),
        ),
    );
    const metric = {
      sampleSize: tasks!.length,
      sampleLimit: 500,
      taskSuccessRate: finished.length
        ? completed.length / finished.length
        : null,
      verifiedTaskCompletionRate: finished.length
        ? verified.length / finished.length
        : null,
      averageFinishedTaskDurationMs: finished.length
        ? finished.reduce(
            (n, t) => n + Date.parse(t.updated_at) - Date.parse(t.created_at),
            0,
          ) / finished.length
        : null,
      modelTokens: (usage.data || []).reduce((n, r) => n + r.tokens, 0),
      averageModelLatencyMs: usage.data?.length
        ? usage.data.reduce((n, r) => n + r.duration_ms, 0) / usage.data.length
        : null,
      averageCostPerTaskUsd:
        usage.data?.length && usage.data.every((r) => r.cost_usd !== null)
          ? usage.data.reduce((n, r) => n + Number(r.cost_usd), 0) /
            tasks!.length
          : null,
      toolFailureRate: tools.data?.length
        ? tools.data.filter((t) => t.outcome === "failed").length /
          tools.data.length
        : null,
      userInterventions: (events.data || []).filter((e) =>
        [
          "pause",
          "mode",
          "revoke",
          "user_verification",
          "plan_amended",
        ].includes(e.event),
      ).length,
      resumedTasks: new Set(
        (events.data || [])
          .filter((e) => e.event === "resume")
          .map((e) => e.task_id),
      ).size,
      modeUsage: Object.fromEntries(
        ["guide", "do", "together"].map((mode) => [
          mode,
          tasks!.filter((t) => t.mode === mode).length,
        ]),
      ),
    };
    return Response.json(metric, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
