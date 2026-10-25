"use client";
import { useEffect, useState } from "react";
import { browserDb } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
export function Billing({
  availablePlans = [],
  portalEnabled = false,
}: {
  availablePlans?: string[];
  portalEnabled?: boolean;
}) {
  const [plans, setPlans] = useState<
      {
        id: string;
        name: string;
        price_monthly: number;
        analysis_limit: number;
        audio_limit: number;
      }[]
    >([]),
    [current, setCurrent] = useState("free"),
    [usage, setUsage] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const client = browserDb();
    Promise.all([
      client
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("price_monthly"),
      client.from("subscriptions").select("plan_id,status").maybeSingle(),
      client
        .from("usage_events")
        .select("*", { count: "exact", head: true })
        .in("event_type", ["audio", "analysis"])
        .gte(
          "created_at",
          new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ).toISOString(),
        ),
    ]).then(([p, s, u]) => {
      if (p.error || s.error || u.error)
        setError("Could not load billing data.");
      setPlans(p.data || []);
      if (s.data && ["active", "trialing"].includes(s.data.status))
        setCurrent(s.data.plan_id);
      setUsage(u.count || 0);
    });
  }, []);
  async function pay(plan?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, portal: !plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.url) location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h2>Find the right flow for you.</h2>
      <p>
        Current plan: {current} · {usage} interactions this month
      </p>
      <p role="alert" className="error">
        {error}
      </p>
      <div className="pricing-grid">
        {plans.map((p) => (
          <div className="surface" key={p.id}>
            <h2>{p.name}</h2>
            <p className="plan-price">
              ${p.price_monthly}
              <small>/mo</small>
            </p>
            <p>{p.analysis_limit} guidance requests</p>
            <p>{p.audio_limit} audio requests</p>
            <Button
              disabled={
                busy ||
                p.id === "free" ||
                p.id === current ||
                !availablePlans.includes(p.id)
              }
              onClick={() => pay(p.id)}
            >
              {p.id === current
                ? "Current plan"
                : availablePlans.includes(p.id)
                  ? "Choose " + p.name
                  : "Coming soon"}
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        disabled={busy || current === "free" || !portalEnabled}
        onClick={() => pay()}
      >
        Manage subscription & invoices
      </Button>
      <p className="fineprint">
        Audio requests include transcription and speech output. Requests reserve
        quota before processing; provider failures also consume a reservation.
        Team workspaces are not yet available.
      </p>
    </>
  );
}
