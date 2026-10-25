import { z } from "zod";
import { identity } from "@/lib/auth/server";
import { checkDatabase } from "@/lib/errors";
import { sameOrigin, failure } from "@/lib/security";
const schema = z.object({
  mode: z.enum(["wake", "guide", "live"]),
  objective: z.string().trim().min(1).max(4000),
  agentId: z.string().uuid().optional(),
});
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const body = schema.parse(await req.json());
    const { client, user } = await identity();
    const { data, error } = await client
      .from("sessions")
      .insert({
        user_id: user.id,
        mode: body.mode,
        title: body.objective.slice(0, 100),
        objective: body.objective,
        ...(body.agentId ? { agent_id: body.agentId } : {}),
      })
      .select("id")
      .single();
    checkDatabase(error);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
