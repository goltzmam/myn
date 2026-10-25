import Link from "next/link";
export default function Page() {
  let project;
  try {
    project = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    ).hostname.split(".")[0];
  } catch {}
  return (
    <section className="surface">
      <span className="eyebrow">CONFIGURAÇÃO INICIAL</span>
      <h1>Ative o histórico e seu mentor.</h1>
      <p>
        Seu login está funcionando, mas o armazenamento de conversas ainda
        precisa ser preparado. Isso é feito uma vez pelo proprietário do projeto
        Supabase.
      </p>
      <ol>
        <li>
          <a href="/setup/myn-database.sql" download="myn-database.sql">
            Baixe o arquivo de configuração do banco.
          </a>
        </li>
        <li>
          <a
            href={
              project
                ? `https://supabase.com/dashboard/project/${project}/sql/new`
                : "https://supabase.com/dashboard"
            }
            target="_blank"
            rel="noreferrer"
          >
            Abra o SQL Editor do seu projeto Supabase.
          </a>
        </li>
        <li>
          Cole todo o conteúdo do arquivo no editor e clique em Run. O script
          preserva dados existentes e pode ser executado novamente.
        </li>
      </ol>
      <p>
        Somente o proprietário do banco pode executar esse passo. Não informe
        chaves secretas aqui. Depois, volte ao MYN e atualize a página.
      </p>
      <Link className="button primary" href="/app">
        Verificar novamente
      </Link>{" "}
      <Link className="button secondary" href="/try/guide">
        Testar meus dispositivos
      </Link>
    </section>
  );
}
