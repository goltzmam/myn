import { identity } from "@/lib/auth/server";
import { openai } from "@/lib/ai/provider";
import { requestSchema, policy } from "@/lib/guide";
import {
  activeSession,
  reserve,
  context,
  saveQuestion,
} from "@/lib/sessions/server";
import { databaseError, publicError } from "@/lib/errors";
import { sameOrigin, failure } from "@/lib/security";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const body = requestSchema.omit({ image: true }).parse(await req.json());
    const { client, user } = await identity();
    const session = await activeSession(client, user.id, body.sessionId);
    if (session.mode !== "wake") throw new Error("Forbidden");
    const turnId = body.turnId || crypto.randomUUID();
    await saveQuestion(client, session.id, turnId, body.message);
    await reserve(client, session.id, "analysis");
    const memory = await context(client, session);
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
              agent: memory.agent,
              history: memory.history,
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
              p_turn: turnId,
            });
            let warning;
            if (error) {
              try {
                databaseError(error);
              } catch (problem) {
                const safe = publicError(problem);
                warning = { code: safe.code, message: safe.message };
              }
            }
            emit({
              done: true,
              saved: !error,
              turnId,
              ...(warning ? { warning } : {}),
            });
          } catch (error) {
            const e = publicError(error);
            emit({ error: e.message, code: e.code });
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
