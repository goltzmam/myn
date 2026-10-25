import { notFound } from "next/navigation";
import Link from "next/link";
import { DeviceLab } from "@/components/device-lab";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (["guide", "wake", "live", "settings"].includes(section))
    return <DeviceLab mode={section} />;
  if (!["agents", "history", "billing"].includes(section)) notFound();
  return (
    <section className="surface">
      <span className="eyebrow">EXPERIMENTAR MYN</span>
      <h1>
        {section === "agents"
          ? "Seu especialista para cada tarefa."
          : section === "history"
            ? "Seu histórico começa com a primeira sessão."
            : "Mais espaço para suas ideias."}
      </h1>
      <p>
        {section === "agents"
          ? "Coding, Marketing, Spreadsheet, E-commerce e Productivity: especialistas que compartilham o mesmo motor de visão e conversa. Crie uma conta para selecionar ou criar seu agente."
          : section === "history"
            ? "As sessões desta área de teste não são salvas. O histórico privado fica disponível depois do login e da conexão com o banco."
            : "Você pode conhecer o produto sem cadastrar cartão. Pagamentos e assinaturas ficam disponíveis somente no ambiente autenticado e com o provedor configurado."}
      </p>
      <Link className="button primary" href="/signup">
        Criar conta
      </Link>{" "}
      <Link className="button secondary" href="/try/guide">
        Testar tela e microfone
      </Link>
    </section>
  );
}
