"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  AudioLines,
  ScanEye,
  Radio,
  ArrowRight,
  Code2,
  Table2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { translations } from "@/lib/i18n";
import { usePreferences } from "@/stores/preferences";
export function Dashboard({
  sessions,
  usage,
  basePath = "/app",
}: {
  sessions: { id: string; title: string; mode: string; started_at: string }[];
  usage: number;
  basePath?: string;
}) {
  const t = translations[usePreferences((s) => s.language)];
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <span className="star">✳</span> YOUR NEXT CHAPTER STARTS HERE
        </div>
        <h1>{t.headline}</h1>
        <p>{t.subhead}</p>
      </div>
      <div className="section-label">
        THREE WAYS TO FIND YOUR FLOW <span>Built around the way you work</span>
      </div>
      <div className="mode-grid">
        {[
          {
            id: "wake",
            Icon: AudioLines,
            title: "Think out loud.",
            text: "A conversation can change everything. Meet your everyday thinking partner.",
            label: "Start a conversation",
            color: "purple",
          },
          {
            id: "guide",
            Icon: ScanEye,
            title: "See it. Solve it.",
            text: "Share your screen. Get step-by-step guidance, right where you need it.",
            label: "Let’s work through it",
            color: "mint",
          },
          {
            id: "live",
            Icon: Radio,
            title: "Stay in the moment.",
            text: "Turn your thoughts into clarity with voice assistance that keeps up.",
            label: "Start a live session",
            color: "peach",
          },
        ].map(({ id, Icon, title, text, label, color }, i) => (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            key={id}
          >
            <Link href={basePath + "/" + id} className={"mode-card " + color}>
              <div className="card-top">
                <span className="mode-icon">
                  <Icon size={25} />
                </span>
                <span className="mode-name">{id.toUpperCase()}</span>
                <ArrowUpRight size={18} />
              </div>
              <div className={"mode-art " + id}>
                {id === "wake" ? (
                  <div className="orb" />
                ) : id === "guide" ? (
                  <div className="mini-window">
                    <div>● ● ●</div>
                    <span />
                    <span />
                    <div className="mini-cursor">↖</div>
                    <small>Your next step, made clear.</small>
                  </div>
                ) : (
                  <div className="wave">
                    {Array.from({ length: 25 }, (_, n) => (
                      <i
                        key={n}
                        style={{ height: 14 + Math.sin(n * 1.8) ** 2 * 60 }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <h2>{title}</h2>
              <p>{text}</p>
              <div className="card-action">
                {label}
                <ArrowRight size={17} />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      <div className="dashboard-bottom">
        <section>
          <div className="section-title">
            <h2>Pick up where you left off</h2>
            <Link href={basePath + "/history"}>
              View history <ArrowUpRight size={14} />
            </Link>
          </div>
          {sessions.length ? (
            sessions.map((s) => (
              <Link
                className="session-row"
                href={basePath + "/history/" + s.id}
                key={s.id}
              >
                <span className="session-icon">
                  <HistoryIcon mode={s.mode} />
                </span>
                <div>
                  <strong>{s.title}</strong>
                  <small>
                    {s.mode} · {new Date(s.started_at).toLocaleDateString()}
                  </small>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <Sparkles size={24} />
              <h3>A fresh start. Endless possibilities.</h3>
              <p>Your conversations and guided tasks will appear here.</p>
              <Link href={basePath + "/guide"}>
                Start your first session <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </section>
        <section>
          <div className="section-title">
            <h2>A little expertise goes a long way</h2>
          </div>
          <Link href={basePath + "/agents"} className="expert-row">
            <span className="expert-icon">
              <Code2 size={21} />
            </span>
            <div>
              <strong>Coding Expert</strong>
              <small>From first line to final deploy.</small>
            </div>
            <ArrowUpRight size={16} />
          </Link>
          <Link href={basePath + "/agents"} className="expert-row">
            <span className="expert-icon mint-text">
              <Table2 size={21} />
            </span>
            <div>
              <strong>Spreadsheet Expert</strong>
              <small>Make sense of every cell.</small>
            </div>
            <ArrowUpRight size={16} />
          </Link>
          <div className="usage-note">
            <ShieldCheck size={16} />
            <span>
              {usage} AI requests this month ·{" "}
              <Link href={basePath + "/billing"}>View usage</Link>
            </span>
          </div>
        </section>
      </div>
      <div className="flow-note">
        <span>✳</span>
        <p>You bring the ambition. We’ll help with the next step.</p>
        <Link href={basePath + "/guide"}>
          Find your flow <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
function HistoryIcon({ mode }: { mode: string }) {
  return mode === "guide" ? (
    <ScanEye size={20} />
  ) : mode === "live" ? (
    <Radio size={20} />
  ) : (
    <AudioLines size={20} />
  );
}
