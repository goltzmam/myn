import { identity } from "@/lib/auth/server";
import { serviceDb } from "@/lib/database/admin";
import { sameOrigin, failure } from "@/lib/security";
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const { user } = await identity();
    const { client } = await identity();
    const { data } = await client
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data && ["active", "trialing", "past_due"].includes(data.status))
      throw new Error("Cancel your subscription before deleting the account.");
    const { error } = await serviceDb().auth.admin.deleteUser(user.id);
    if (error) throw error;
    return Response.json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
