import { identity } from "@/lib/auth/server";
import { failure, sameOrigin } from "@/lib/security";
import { provider } from "@/lib/ai/provider";
import { requestSchema, verifiedSteps } from "@/lib/guide";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (Number(req.headers.get("content-length")) > 650000)
      throw new Error("Payload too large");
    const body = requestSchema.parse(await req.json());
    const { client, user } = await identity();
    const { data: session } = await client
      .from("sessions")
      .select("*")
      .eq("id", body.sessionId)
      .eq("user_id", user.id)
      .single();
    if (
      !session ||
      session.status !== "active" ||
      Date.now() - new Date(session.resumed_at).getTime() > 3600000
    )
      throw new Error("Forbidden");
    const { error: quota } = await client.rpc("reserve_usage", {
      p_session: session.id,
      p_kind: "analysis",
    });
    if (quota) throw new Error("Monthly or request rate limit reached");
    const { data: messages } = await client
      .from("messages")
      .select("role,content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(16);
    let agent;
    if (session.agent_id) {
      const { data } = await client
        .from("agents")
        .select("instructions")
        .eq("id", session.agent_id)
        .single();
      agent = data?.instructions;
    }
    const { data: summary } = await client
      .from("session_summaries")
      .select("summary")
      .eq("session_id", session.id)
      .maybeSingle();
    const { guidance, tokens } = await provider.analyze({
      ...body,
      history: [
        { role: "user", content: "Objective: " + session.objective },
        {
          role: "assistant",
          content:
            "Previous summary (not a current observation): " +
            (summary?.summary || ""),
        },
        ...(messages || []).reverse(),
      ],
      agent,
      mode: session.mode,
    });
    guidance.steps = verifiedSteps(guidance);
    const { error } = await client.rpc("save_exchange", {
      p_session: session.id,
      p_question: body.message,
      p_reply: guidance.reply,
      p_steps: guidance.steps,
      p_summary: guidance.summary,
      p_tokens: tokens,
    });
    if (error) throw error;
    return Response.json(guidance, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
