import Link from "next/link";
import { notFound } from "next/navigation";
import { SettingsNavigation } from "@/components/settings-navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  const selected = section[0] || "account";
  if (!["account", "audio", "privacy", "billing", "history"].includes(selected))
    notFound();
  return (
    <div className="settings-page">
      <SettingsNavigation section={selected} base="/try" />
      <section className="surface">
        <h2>Seu espaço, do seu jeito.</h2>
        <p>
          Entre na sua conta para ver suas conversas, ajustar suas preferências
          e gerenciar sua assinatura.
        </p>
        <Link className="button primary" href="/login">
          Entrar
        </Link>
      </section>
    </div>
  );
}
