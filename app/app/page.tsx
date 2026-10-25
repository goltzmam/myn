import { configured } from "@/lib/config";
import { redirect } from "next/navigation";
import { identity } from "@/lib/auth/server";
import { Dashboard } from "@/components/dashboard";
export default async function Home() {
  if (!configured()) redirect("/login?setup=1");
  let auth;
  try {
    auth = await identity();
  } catch {
    redirect("/login");
  }
  const { client, user } = auth;
  const [{ data: sessions, error }, { count, error: usageError }] =
    await Promise.all([
      client
        .from("sessions")
        .select("id,title,mode,started_at")
        .order("started_at", { ascending: false })
        .limit(3),
      client
        .from("usage_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("event_type", ["analysis", "audio"])
        .gte(
          "created_at",
          new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ).toISOString(),
        ),
    ]);
  if (error || usageError)
    return (
      <div className="notice">
        Database unavailable. Apply the Supabase migration and refresh.
      </div>
    );
  return <Dashboard sessions={sessions || []} usage={count || 0} />;
}
