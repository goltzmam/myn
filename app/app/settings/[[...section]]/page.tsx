import { notFound } from "next/navigation";
import { Settings } from "@/components/settings";
import { SettingsNavigation } from "@/components/settings-navigation";
import { Billing } from "@/components/billing";
import { Records } from "@/components/records";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  const selected = section[0] || "account";
  if (
    !["account", "audio", "privacy", "billing", "history"].includes(selected) ||
    section.length > (selected === "history" ? 2 : 1)
  )
    notFound();
  return (
    <div className="settings-page">
      <SettingsNavigation section={selected} />
      {selected === "billing" ? (
        <Billing
          portalEnabled={Boolean(process.env.STRIPE_SECRET_KEY)}
          availablePlans={
            process.env.STRIPE_SECRET_KEY
              ? [
                  ["pro", process.env.STRIPE_PRO_PRICE_ID],
                  ["max", process.env.STRIPE_MAX_PRICE_ID],
                  ["teams", process.env.STRIPE_TEAMS_PRICE_ID],
                ]
                  .filter(([, price]) => Boolean(price))
                  .map(([id]) => id as string)
              : []
          }
        />
      ) : selected === "history" ? (
        <Records kind="history" id={section[1]} />
      ) : (
        <Settings section={selected} />
      )}
    </div>
  );
}
