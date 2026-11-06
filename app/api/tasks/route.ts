import { z } from "zod";
import { identity } from "@/lib/auth/server";
import { failure, sameOrigin } from "@/lib/security";
import { activeSession } from "@/lib/sessions/server";
import { checkDatabase } from "@/lib/errors";
import { modeSchema } from "@/lib/agent/schema";
import { planTask } from "@/lib/agent/server";
import { executionAvailable } from "@/lib/agent/browser";
export const maxDuration = 60;
export async function GET(req: Request) {
  try {
    const { client, user } = await identity();
    const session = new URL(req.url).searchParams.get("session");
    let query = client
      .from("agent_tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (session)
      query = query.eq("session_id", z.string().uuid().parse(session));
    const { data, error } = await query;
    checkDatabase(error);
    return Response.json(
      { tasks: data, executionAvailable: executionAvailable() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const input = z
      .object({
        sessionId: z.string().uuid(),
        objective: z.string().trim().min(3).max(4000),
        mode: modeSchema.default("together"),
      })
      .strict()
      .parse(await req.json());
    const { client, user } = await identity();
    await activeSession(client, user.id, input.sessionId);
    const { data, error } = await client.rpc("agent_create", {
      p_session: input.sessionId,
      p_objective: input.objective,
      p_mode: input.mode,
    });
    checkDatabase(error);
    const task = await planTask(
      client,
      data,
      AbortSignal.any([req.signal, AbortSignal.timeout(45000)]),
    );
    return Response.json(
      { task, executionAvailable: executionAvailable() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
