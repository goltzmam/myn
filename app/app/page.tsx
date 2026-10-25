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
  const { client } = auth;
  const { data: sessions, error } = await client
    .from("sessions")
    .select("id,title,mode,started_at")
    .order("started_at", { ascending: false })
    .limit(4);
  return (
    <>
      {error && (
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
      <Dashboard sessions={sessions || []} />
    </>
  );
}
