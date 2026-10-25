import "server-only";
import Stripe from "stripe";
export interface BillingAdapter {
  checkout(input: {
    userId: string;
    email: string;
    plan: string;
    origin: string;
  }): Promise<string | null>;
}
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error("Configure STRIPE_SECRET_KEY to enable billing.");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
export const billing: BillingAdapter = {
  async checkout({ userId, email, plan, origin }) {
    const prices: Record<string, string | undefined> = {
      pro: process.env.STRIPE_PRO_PRICE_ID,
      max: process.env.STRIPE_MAX_PRICE_ID,
      teams: process.env.STRIPE_TEAMS_PRICE_ID,
    };
    const price = prices[plan];
    if (!price) throw new Error("Configure the Stripe price for this plan.");
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: userId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { user_id: userId, plan } },
      success_url: origin + "/app/billing?success=1",
      cancel_url: origin + "/app/billing",
    });
    return session.url;
  },
};
