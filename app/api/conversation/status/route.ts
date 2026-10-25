import { identity } from "@/lib/auth/server";
import { failure, sameOrigin } from "@/lib/security";
import { openai } from "@/lib/ai/provider";
import { checkDatabase } from "@/lib/errors";
export const maxDuration = 45;
export async function GET() {
  try {
    const { client } = await identity();
    const { error } = await client.from("sessions").select("id").limit(0);
    return Response.json(
      {
        conversationConfigured: Boolean(
          (process.env.MYN_AI_KEY || process.env.OPENAI_API_KEY || "").trim(),
        ),
        storageReady: !error,
        storageCode: error?.code || null,
        connectionTested: false,
        deploymentEnvironment: process.env.VERCEL_ENV || "local",
        revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { client } = await identity();
    const ai = openai();
    const { error } = await client.rpc("reserve_usage", {
      p_session: null,
      p_kind: "analysis",
    });
    checkDatabase(error);
    await ai.responses.create(
      {
        model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
        store: false,
        max_output_tokens: 16,
        input: "Reply with OK.",
      },
      { signal: req.signal },
    );
    return Response.json(
      { connected: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
