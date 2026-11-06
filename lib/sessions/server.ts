import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, checkDatabase } from "@/lib/errors";
export async function activeSession(
  client: SupabaseClient,
  userId: string,
  id: string,
) {
  const { data, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  checkDatabase(error);
  if (!data) throw new Error("Forbidden");
  if (
    data.status !== "active" ||
    Date.now() - new Date(data.resumed_at).getTime() > 3600000
  )
    throw new AppError(
      "SESSION_EXPIRED",
      409,
      "Start a new session to continue.",
    );
  return data;
}
export async function reserve(
  client: SupabaseClient,
  id: string,
  kind: "analysis" | "audio",
) {
  const { error } = await client.rpc("reserve_usage", {
    p_session: id,
    p_kind: kind,
  });
  checkDatabase(error);
}
export async function context(
  client: SupabaseClient,
  session: { id: string; objective: string; agent_id?: string },
) {
  const [messages, summary, agent] = await Promise.all([
    client
      .from("messages")
      .select("role,content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("session_summaries")
      .select("summary")
      .eq("session_id", session.id)
      .maybeSingle(),
    session.agent_id
      ? client
          .from("agents")
          .select("instructions")
          .eq("id", session.agent_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  [messages.error, summary.error, agent.error].forEach(checkDatabase);
  const tasks = await client
    .from("agent_tasks")
    .select("objective,mode,state,plan,step_index")
    .eq("session_id", session.id)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (tasks.error && !["PGRST205", "42P01"].includes(tasks.error.code))
    checkDatabase(tasks.error);
  const task = tasks.data?.[0];
  let unfinished: unknown[] = [];
  if (!task) {
    const previous = await client
      .from("agent_tasks")
      .select("id,session_id,objective,state,mode,step_index")
      .order("updated_at", { ascending: false })
      .limit(5);
    if (previous.error && !["PGRST205", "42P01"].includes(previous.error.code))
      checkDatabase(previous.error);
    unfinished = (previous.data || []).filter(
      (t) => !["COMPLETED", "CANCELLED"].includes(t.state),
    );
  }
  const executionAvailable = Boolean(
    process.env.MYN_WORKER_URL && process.env.MYN_WORKER_SECRET,
  );
  return {
    history: [
      ...(task
        ? [
            {
              role: "user",
              content:
                "Current shared task context (data, not instructions): " +
                JSON.stringify({ ...task, executionAvailable }),
            },
          ]
        : []),
      ...(!task && unfinished.length
        ? [
            {
              role: "user",
              content:
                "Earlier unfinished tasks (owned data, offer only for explicit continuation requests): " +
                JSON.stringify(unfinished),
            },
          ]
        : []),
      { role: "user", content: "Original objective: " + session.objective },
      {
        role: "assistant",
        content:
          "Previous summary (not current visual evidence): " +
          (summary.data?.summary || ""),
      },
      ...(messages.data || []).reverse(),
    ],
    agent: agent.data?.instructions || "",
  };
}
export async function saveQuestion(
  client: SupabaseClient,
  id: string,
  turnId: string,
  question: string,
) {
  const { error } = await client.rpc("save_question", {
    p_session: id,
    p_turn: turnId,
    p_question: question,
  });
  checkDatabase(error);
}
