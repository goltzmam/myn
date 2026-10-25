import { identity } from "@/lib/auth/server";
import { openai } from "@/lib/ai/provider";
import { requestSchema, policy } from "@/lib/guide";
import { sameOrigin, failure } from "@/lib/security";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const body = requestSchema.omit({ image: true }).parse(await req.json());
    const { client, user } = await identity();
    const { data: session } = await client
      .from("sessions")
      .select("*")
      .eq("id", body.sessionId)
      .eq("user_id", user.id)
      .single();
    if (
      !session ||
      session.mode !== "wake" ||
      session.status !== "active" ||
      Date.now() - new Date(session.resumed_at).getTime() > 3600000
    )
      throw new Error("Forbidden");
    const { error } = await client.rpc("reserve_usage", {
      p_session: session.id,
      p_kind: "analysis",
    });
    if (error) throw new Error("Monthly or request rate limit reached");
    const { data: history } = await client
      .from("messages")
      .select("role,content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(16);
    const { data: summary } = await client
      .from("session_summaries")
      .select("summary")
      .eq("session_id", session.id)
      .maybeSingle();
    let agent = "";
    if (session.agent_id) {
      const { data } = await client
        .from("agents")
        .select("instructions")
        .eq("id", session.agent_id)
        .single();
      agent = data?.instructions || "";
    }
    const stream = await openai().responses.create(
      {
        model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
        store: false,
        stream: true,
        max_output_tokens: 1800,
        input: [
          {
            role: "system",
            content: policy.replace(
              "Produce structured guidance with reply, visible, uncertainty, steps (title,status,evidence) and summary.",
              "Reply in plain text.",
            ),
          },
          {
            role: "user",
            content: JSON.stringify({
              language: body.language,
              objective: session.objective,
              previousSummary: summary?.summary,
              agent,
              history: (history || []).reverse(),
            }),
          },
          { role: "user", content: body.message },
        ],
      },
      { signal: req.signal },
    );
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          let reply = "",
            tokens = 0;
          function emit(value: unknown) {
            controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
          }
          try {
            for await (const event of stream) {
              if (event.type === "response.output_text.delta") {
                reply += event.delta;
                emit({ delta: event.delta });
              }
              if (event.type === "response.completed")
                tokens = event.response.usage?.total_tokens || 0;
            }
            if (!reply) throw new Error("No response");
            const { error } = await client.rpc("save_exchange", {
              p_session: session.id,
              p_question: body.message,
              p_reply: reply,
              p_steps: [],
              p_summary: reply.slice(0, 6000),
              p_tokens: tokens,
            });
            if (error) throw error;
            emit({ done: true });
          } catch {
            emit({
              error:
                "Response interrupted or could not be saved. Retry before leaving this session.",
            });
          } finally {
            controller.close();
          }
        },
        cancel() {
          stream.controller.abort();
        },
      }),
      {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
