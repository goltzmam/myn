import { identity } from "@/lib/auth/server";
import { failure, sameOrigin } from "@/lib/security";
import { provider } from "@/lib/ai/provider";
import { requestSchema, verifiedSteps } from "@/lib/guide";
import {
  activeSession,
  reserve,
  context,
  saveQuestion,
} from "@/lib/sessions/server";
import { databaseError, publicError } from "@/lib/errors";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (Number(req.headers.get("content-length")) > 650000)
      throw new Error("Payload too large");
    const body = requestSchema.parse(await req.json());
    const { client, user } = await identity();
    const session = await activeSession(client, user.id, body.sessionId);
    const turnId = body.turnId || crypto.randomUUID();
    await saveQuestion(client, session.id, turnId, body.message);
    await reserve(client, session.id, "analysis");
    const memory = await context(client, session);
    const { guidance, tokens } = await provider.analyze(
      {
        ...body,
        ...memory,
        mode: session.mode,
      },
      { signal: req.signal },
    );
    guidance.steps = verifiedSteps(guidance);
    const { error } = await client.rpc("save_exchange", {
      p_session: session.id,
      p_question: body.message,
      p_reply: guidance.reply,
      p_steps: guidance.steps,
      p_summary: guidance.summary,
      p_tokens: tokens,
      p_turn: turnId,
    });
    let warning;
    if (error) {
      try {
        databaseError(error);
      } catch (e) {
        const safe = publicError(e);
        warning = { code: safe.code, message: safe.message };
      }
    }
    return Response.json(
      { ...guidance, turnId, saved: !error, ...(warning ? { warning } : {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
