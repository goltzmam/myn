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
  return {
    history: [
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
