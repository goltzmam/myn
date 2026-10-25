export const dynamic = "force-dynamic";
import { identity } from "@/lib/auth/server";
import { serviceDb } from "@/lib/database/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
export default async function Admin() {
  let auth;
  try {
    auth = await identity();
  } catch {
    redirect("/login");
  }
  if (auth.user.app_metadata?.role !== "admin") notFound();
  const client = serviceDb();
  const results = await Promise.all(
    ["profiles", "sessions", "subscriptions", "usage_events"].map(
      async (table) => {
        const { count, error } = await client
          .from(table)
          .select("*", { count: "exact", head: true });
        return { table, count, error };
      },
    ),
  );
  return (
    <main className="admin-page">
      <Link href="/app" className="logo">
        myn.
      </Link>
      <h1>System overview</h1>
      <p>Administrator access verified on the server.</p>
      <div className="records-grid">
        {results.map((r) => (
          <section className="surface" key={r.table}>
            <h2>{r.table}</h2>
            <p>{r.error ? "Unavailable" : r.count}</p>
          </section>
        ))}
      </div>
      <p>
        Revenue, margin, churn, and infrastructure cost reporting require
        operational billing data and are not calculated in this version.
      </p>
    </main>
  );
}
