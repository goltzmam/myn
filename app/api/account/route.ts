import { identity } from "@/lib/auth/server";
import { sameOrigin, failure } from "@/lib/security";
import { AppError, checkDatabase } from "@/lib/errors";
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const { client } = await identity();
    const { error } = await client.rpc("delete_own_account");
    if (error?.message?.includes("Active subscription"))
      throw new AppError(
        "ACTIVE_SUBSCRIPTION",
        409,
        "Cancel your subscription before deleting your account.",
      );
    checkDatabase(error);
    return Response.json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
