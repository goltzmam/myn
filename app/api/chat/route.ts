import { z } from "zod";
import { identity } from "@/lib/auth/server";
import { openai } from "@/lib/ai/provider";
import { requestSchema, policy, conversationLanguageSchema } from "@/lib/guide";
import {
  activeSession,
  reserve,
  context,
  saveQuestion,
} from "@/lib/sessions/server";
import { checkDatabase, databaseError, publicError } from "@/lib/errors";
import { sameOrigin, failure } from "@/lib/security";
export const maxDuration = 60;
const schema = requestSchema
  .extend({
    kind: z.enum(["message", "welcome"]).default("message"),
    message: z.string().trim().max(4000).default(""),
    locale: conversationLanguageSchema.optional(),
    screenAvailable: z.boolean().optional(),
  })
  .refine(
    (v) => v.kind === "welcome" || v.message.length > 0,
    "A message is required.",
  );
export async function POST(req: Request) {
  let questionSaved = false;
  let turnId: string | undefined;
  try {
    sameOrigin(req);
    if (Number(req.headers.get("content-length")) > 650000)
      throw new Error("Payload too large");
    const body = schema.parse(await req.json());
    const { client, user } = await identity();
    const session = await activeSession(client, user.id, body.sessionId);
    turnId = body.turnId || crypto.randomUUID();
    if (body.kind === "message") {
      await saveQuestion(client, session.id, turnId, body.message);
      questionSaved = true;
    }
    const ai = openai();
    await reserve(client, session.id, "analysis");
    const memory = await context(client, session);
    let name = "";
    if (body.kind === "welcome") {
      const profile = await client
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      checkDatabase(profile.error);
      name = profile.data?.full_name?.slice(0, 100) || "";
    }
    const language =
      body.language === "auto" && body.kind === "welcome"
        ? body.locale || "en"
        : body.language;
    const instruction =
      body.kind === "welcome"
        ? `Begin a natural spoken conversation as MYN. This is an introduction, not a user utterance. If no preferred name is available in the context or prior conversation, naturally ask how they would like to be addressed, without blocking help. Introduce yourself briefly${name ? " and address the user by their preferred name from the untrusted context" : ""}. Ask what they would like to work on. ${body.image ? "A current screen image is included; refer only to visible evidence." : body.screenAvailable ? "Invite them to share a window using the eye button when they are ready." : "Do not ask for screen sharing because this browser does not support it."} Keep it warm, useful and at most three short sentences. If there is earlier history, naturally offer to continue instead of a long repeated introduction.`
        : body.message;
    const stream = await ai.responses.create(
      {
        model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
        store: false,
        stream: true,
        max_output_tokens: 1600,
        input: [
          {
            role: "system",
            content: policy.replace(
              "Produce structured guidance with reply, visible, uncertainty, steps (title,status,evidence) and summary.",
              "Reply in natural plain text. Do not output JSON or a separate summary in the spoken answer.",
            ),
          },
          {
            role: "user",
            content: JSON.stringify({
              language,
              preferredName: name,
              objective: session.objective,
              agent: memory.agent,
              history: memory.history,
            }),
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: instruction },
              ...(body.image
                ? [
                    {
                      type: "input_image" as const,
                      image_url: body.image,
                      detail: "high" as const,
                    },
                  ]
                : []),
            ],
          },
        ],
      },
      { signal: req.signal },
    );
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          let reply = "",
            tokens = 0,
            ended = false;
          const emit = (value: unknown) => {
            if (!req.signal.aborted)
              controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
          };
          try {
            emit({ accepted: true, questionSaved, turnId });
            for await (const event of stream) {
              if (
                event.type === "response.output_text.delta" ||
                event.type === "response.refusal.delta"
              ) {
                reply += event.delta;
                emit({ delta: event.delta });
              }
              if (event.type === "response.completed") {
                tokens = event.response.usage?.total_tokens || 0;
                ended = true;
              }
              if (
                event.type === "response.failed" ||
                event.type === "response.incomplete"
              )
                throw new Error("Response interrupted");
            }
            if (!reply || !ended) throw new Error("Response interrupted");
            const saved =
              body.kind === "welcome"
                ? await client.rpc("save_welcome", {
                    p_session: session.id,
                    p_turn: turnId,
                    p_reply: reply,
                    p_tokens: tokens,
                  })
                : await client.rpc("save_exchange", {
                    p_session: session.id,
                    p_question: body.message,
                    p_reply: reply,
                    p_steps: [],
                    p_summary: reply.slice(0, 6000),
                    p_tokens: tokens,
                    p_turn: turnId,
                  });
            let warning;
            if (saved.error) {
              try {
                databaseError(saved.error);
              } catch (e) {
                const safe = publicError(e);
                warning = { code: safe.code, message: safe.message };
              }
            }
            emit({
              done: true,
              saved: !saved.error,
              turnId,
              ...(warning ? { warning } : {}),
            });
          } catch (e) {
            const safe = publicError(e);
            emit({
              error: safe.message,
              code: safe.code,
              questionSaved,
              turnId,
            });
          } finally {
            try {
              controller.close();
            } catch {}
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
    return failure(e, { questionSaved, turnId });
  }
}
