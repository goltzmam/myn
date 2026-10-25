import { stripe } from "@/lib/billing/stripe";
import { serviceDb } from "@/lib/database/admin";
export async function POST(req: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  let event;
  try {
    event = stripe().webhooks.constructEvent(
      await req.text(),
      req.headers.get("stripe-signature") || "",
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (
    ![
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  )
    return Response.json({ received: true });
  try {
    const sub = event.data.object as import("stripe").Stripe.Subscription;
    const userId = sub.metadata.user_id,
      plan = sub.metadata.plan;
    if (!userId || !["pro", "max", "teams"].includes(plan))
      throw new Error("Invalid metadata");
    const { error } = await serviceDb().rpc("apply_billing_event", {
      p_event: event.id,
      p_event_type: event.type,
      p_created: event.created,
      p_user: userId,
      p_plan: plan,
      p_customer: String(sub.customer),
      p_subscription: sub.id,
      p_status: sub.status,
      p_period: new Date(
        (sub.items.data[0]?.current_period_end || 0) * 1000,
      ).toISOString(),
    });
    if (error) throw error;
    return Response.json({ received: true });
  } catch {
    return Response.json(
      { error: "Webhook processing failed; retry required" },
      { status: 500 },
    );
  }
}
