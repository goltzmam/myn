"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Mic,
  Eye,
  MessageCircle,
  CornerDownRight,
} from "lucide-react";
import { usePreferences } from "@/stores/preferences";
export function Dashboard({
  sessions,
  usage: unused,
  basePath = "/app",
}: {
  sessions: { id: string; title: string; mode: string; started_at: string }[];
  usage: number;
  basePath?: string;
}) {
  const pt = usePreferences((s) => s.language) === "pt-BR",
    router = useRouter(),
    [input, setInput] = useState("");
  const start = (intent?: string) => {
    if (intent) {
      router.push(basePath + "/elo?intent=" + intent);
      return;
    }
    if (input.trim()) {
      const key = crypto.randomUUID();
      sessionStorage.setItem("myn-draft:" + key, input.trim());
      router.push(basePath + "/elo?draft=" + key);
    } else router.push(basePath + "/elo");
  };
  return (
    <div className="home-experience">
      <section className="home-welcome">
        <div className="elo-mark" aria-hidden="true">
          <span />
          <span />
        </div>
        <p className="welcome-kicker">
          {pt ? "Bom ter você por aqui." : "Good to have you here."}
        </p>
        <h1>{pt ? "O próximo passo, juntos." : "Your next step, together."}</h1>
        <form
          className="home-composer"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <textarea
            aria-label={
              pt ? "O que você tem em mente?" : "What’s on your mind?"
            }
            placeholder={
              pt ? "O que você tem em mente?" : "What’s on your mind?"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={4000}
            rows={2}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                if (input.trim()) start();
              }
            }}
          />
          <div className="home-composer-actions">
            <div>
              <button
                type="button"
                className="composer-tool"
                aria-label={pt ? "Conversar por voz" : "Talk by voice"}
                title={pt ? "Conversar por voz" : "Talk by voice"}
                onClick={() => start("voice")}
              >
                <Mic size={20} />
              </button>
              <button
                type="button"
                className="composer-tool"
                aria-label={pt ? "Compartilhar tela" : "Share screen"}
                title={pt ? "Compartilhar tela" : "Share screen"}
                onClick={() => start("screen")}
              >
                <Eye size={21} />
              </button>
            </div>
            <button
              className="send-orb"
              disabled={!input.trim()}
              aria-label={pt ? "Começar conversa" : "Start conversation"}
            >
              <ArrowUp size={20} />
            </button>
          </div>
        </form>
        <div className="conversation-prompts">
          {(pt
            ? [
                "Me ajude com esta tela",
                "Quero aprender algo",
                "Vamos organizar uma ideia",
              ]
            : [
                "Help me with this screen",
                "I want to learn something",
                "Let’s work through an idea",
              ]
          ).map((text, i) => (
            <button
              key={text}
              onClick={() => {
                setInput(text);
                document
                  .querySelector<HTMLTextAreaElement>(".home-composer textarea")
                  ?.focus();
              }}
            >
              {i === 0 ? (
                <Eye size={14} />
              ) : i === 1 ? (
                <MessageCircle size={14} />
              ) : (
                <CornerDownRight size={14} />
              )}{" "}
              {text}
            </button>
          ))}
        </div>
      </section>
      {sessions.length > 0 && (
        <section className="home-recent">
          <div>
            <h2>
              {pt ? "Continuar de onde paramos" : "Pick up where we left off"}
            </h2>
            <Link href={basePath + "/settings/history"}>
              {pt ? "Ver todas" : "View all"}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {sessions.map((s) => (
            <Link
              className="recent-conversation"
              key={s.id}
              href={basePath + "/elo?session=" + s.id}
            >
              <MessageCircle size={17} />
              <span>{s.title}</span>
              <small>
                {new Date(s.started_at).toLocaleDateString(pt ? "pt-BR" : "en")}
              </small>
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
