"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  AudioLines,
  ScanEye,
  Radio,
  Shapes,
  History,
  CreditCard,
  Settings,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { usePreferences } from "@/stores/preferences";
import { translations } from "@/lib/i18n";
import { browserDb } from "@/lib/auth/client";
const items = [
  ["home", "/app", House],
  ["wake", "/app/wake", AudioLines],
  ["guide", "/app/guide", ScanEye],
  ["live", "/app/live", Radio],
  ["agents", "/app/agents", Shapes],
  ["history", "/app/history", History],
  ["billing", "/app/billing", CreditCard],
  ["settings", "/app/settings", Settings],
] as const;
export function Shell({
  children,
  email,
  preview = false,
}: {
  children: React.ReactNode;
  email: string;
  preview?: boolean;
}) {
  const pathname = usePathname(),
    router = useRouter(),
    { language, setLanguage } = usePreferences(),
    t = translations[language];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href={preview ? "/try" : "/app"} className="logo">
          myn<span>.</span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {items.map(([key, url, Icon]) => (
            <Link
              key={key}
              href={preview ? url.replace("/app", "/try") : url}
              className={
                pathname === (preview ? url.replace("/app", "/try") : url) ||
                (url != "/app" &&
                  pathname.startsWith(
                    preview ? url.replace("/app", "/try") : url,
                  ))
                  ? "nav-link selected"
                  : "nav-link"
              }
            >
              <Icon size={18} />
              {t[key]}
              {key === "guide" && <span className="tiny-tag">CORE</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade">
            <span className="eyebrow">A LITTLE MORE POSSIBILITY</span>
            <h3>Find your flow.</h3>
            <p>More time for your big ideas.</p>
            <Link href={preview ? "/try/billing" : "/app/billing"}>
              Explore Pro <ArrowUpRight size={15} />
            </Link>
          </div>
          <button
            className="user-profile"
            onClick={async () => {
              if (!preview) await browserDb().auth.signOut();
              router.push("/login");
              router.refresh();
            }}
            title="Sign out"
          >
            <span className="avatar">{email[0]?.toUpperCase()}</span>
            <span>
              {email.split("@")[0]}
              <small>Personal workspace</small>
            </span>
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="app-header">
          <span>
            <span className="status-dot" />{" "}
            {preview ? "EXPERIMENTAR · SEM CONTA" : "YOUR AI WORKSPACE"}
          </span>
          <div>
            <select
              aria-label="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "pt-BR")}
            >
              <option value="en">English</option>
              <option value="pt-BR">Português</option>
            </select>
            <span className="privacy-pill">
              <ShieldCheck size={14} /> Private by design
            </span>
          </div>
        </header>
        <main className="app-content">
          {preview && (
            <div className="try-banner">
              <strong>Experimentar MYN</strong>
              <span>
                Tela e microfone locais. Sem respostas simuladas de IA.
              </span>
              <Link href="/signup">Criar minha conta →</Link>
            </div>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <span>Less friction. More possibility.</span>
          <span>myn. · Your everyday co-pilot</span>
        </footer>
      </div>
    </div>
  );
}
