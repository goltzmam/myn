import { identity } from "@/lib/auth/server";
import { billing, stripe } from "@/lib/billing/stripe";
import { sameOrigin, failure } from "@/lib/security";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { user, client } = await identity();
    const { error } = await client.rpc("reserve_usage", {
      p_session: null,
      p_kind: "billing",
    });
    if (error) throw new Error("Request rate limit reached");
    const { plan, portal } = await req.json();
    const origin = process.env.APP_URL;
    if (!origin) throw new Error("Configure APP_URL for billing.");
    if (portal) {
      const { data } = await client
        .from("subscriptions")
        .select("provider_customer_id")
        .eq("user_id", user.id)
        .single();
      if (!data?.provider_customer_id) throw new Error("No billing account");
      const session = await stripe().billingPortal.sessions.create({
        customer: data.provider_customer_id,
        return_url: origin + "/app/billing",
      });
      return Response.json({ url: session.url });
    }
    return Response.json({
      url: await billing.checkout({
        userId: user.id,
        email: user.email || "",
        plan,
        origin,
      }),
    });
  } catch (e) {
    return failure(e);
  }
}
