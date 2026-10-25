import { configured } from "@/lib/config";
import { redirect } from "next/navigation";
import { identity } from "@/lib/auth/server";
import Link from "next/link";
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
  return (
    <>
      {(error || usageError) && (
        <section className="notice" role="status">
          <strong>Seu histórico ainda não está disponível.</strong>
          <p>
            Conclua a configuração inicial para conversar com o mentor e guardar
            suas sessões.
          </p>
          <Link className="button secondary" href="/app/setup">
            Ativar mentor e histórico
          </Link>
        </section>
      )}
      <Dashboard sessions={sessions || []} usage={count || 0} />
    </>
  );
}
