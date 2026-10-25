"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Shapes,
  History,
  Eye,
} from "lucide-react";
import { usePreferences } from "@/stores/preferences";
type RecentSession = {
  id: string;
  title: string;
  mode: string;
  started_at: string;
};
export function Dashboard({
  sessions,
  basePath = "/app",
}: {
  sessions: RecentSession[];
  usage?: number;
  basePath?: string;
}) {
  const pt = usePreferences((s) => s.language) === "pt-BR";
  return (
    <div className="home-hub">
      <header className="hub-heading">
        <p>{pt ? "Seu ponto de partida" : "Your starting point"}</p>
        <h1>{pt ? "Bom ter você de volta." : "Welcome back."}</h1>
        <span>
          {pt
            ? "Retome o que importa. Abra espaço para o que vem."
            : "Pick up what matters. Make room for what’s next."}
        </span>
      </header>
      <section className="hub-elo-card" aria-labelledby="hub-elo-title">
        <div className="hub-elo-copy">
          <span className="hub-section-label">Elo</span>
          <h2 id="hub-elo-title">
            {pt
              ? "O próximo passo começa com uma conversa."
              : "Your next step starts with a conversation."}
          </h2>
          <p>
            {pt
              ? "Um lugar para pensar em voz alta, tirar dúvidas e olhar a tela juntos."
              : "A place to think out loud, ask a question, and look at your screen together."}
          </p>
          <Link href={basePath + "/elo"} className="hub-primary-link">
            {pt ? "Entrar no Elo" : "Open Elo"}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="hub-elo-art" aria-hidden="true">
          <div className="hub-orbit orbit-one" />
          <div className="hub-orbit orbit-two" />
          <div className="hub-eye">
            <Eye size={32} strokeWidth={1.2} />
          </div>
          <span>{pt ? "Uma nova perspectiva." : "A fresh perspective."}</span>
        </div>
      </section>
      <div className="hub-lower-grid">
        <section className="hub-conversations">
          <div className="hub-section-heading">
            <h2>{pt ? "De onde paramos" : "Where we left off"}</h2>
            {sessions.length > 0 && (
              <Link href={basePath + "/settings/history"}>
                {pt ? "Ver todas" : "View all"}
                <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
          {sessions.length > 0 ? (
            <div>
              {sessions.map((s) => (
                <Link
                  className="hub-conversation"
                  key={s.id}
                  href={basePath + "/elo?session=" + s.id}
                >
                  <span className="hub-conversation-icon">
                    <MessageCircle size={19} />
                  </span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>
                      {new Date(s.started_at).toLocaleDateString(
                        pt ? "pt-BR" : "en",
                        { day: "numeric", month: "short" },
                      )}
                    </small>
                  </div>
                  <span className="hub-resume-label">
                    {pt ? "Continuar" : "Continue"}
                    <ArrowUpRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="hub-empty-conversations">
              <span>
                <MessageCircle size={21} />
              </span>
              <div>
                <h3>
                  {pt
                    ? "Sua história começa na primeira conversa."
                    : "Your story starts with the first conversation."}
                </h3>
                <p>
                  {pt
                    ? "Depois, você pode voltar e continuar daqui."
                    : "After that, come back and pick up right here."}
                </p>
              </div>
            </div>
          )}
        </section>
        <aside
          className="hub-shortcuts"
          aria-label={pt ? "Seu espaço" : "Your space"}
        >
          <Link href={basePath + "/agents"}>
            <Shapes size={20} />
            <div>
              <strong>
                {pt ? "Uma perspectiva diferente" : "A different perspective"}
              </strong>
              <p>
                {pt
                  ? "Encontre quem acompanha sua próxima ideia."
                  : "Find the right perspective for your next idea."}
              </p>
            </div>
            <ArrowUpRight size={15} />
          </Link>
          <Link href={basePath + "/settings/history"}>
            <History size={20} />
            <div>
              <strong>
                {pt ? "Vale a pena revisitar" : "Worth coming back to"}
              </strong>
              <p>
                {pt
                  ? "Suas conversas, no seu tempo."
                  : "Your conversations, at your own pace."}
              </p>
            </div>
            <ArrowUpRight size={15} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
