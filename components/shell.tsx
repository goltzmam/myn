"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  Eye,
  Shapes,
  Settings,
  Plus,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { usePreferences } from "@/stores/preferences";
import { browserDb } from "@/lib/auth/client";
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
    pt = usePreferences((s) => s.language) === "pt-BR",
    [open, setOpen] = useState(false),
    base = preview ? "/try" : "/app";
  const items = [
    { href: base, label: "Home", Icon: House },
    { href: base + "/elo", label: "Elo", Icon: Eye },
    { href: base + "/agents", label: pt ? "Agente" : "Agents", Icon: Shapes },
  ];
  const settings =
    pathname.includes("/settings") ||
    pathname.includes("/history") ||
    pathname.includes("/billing");
  const title = settings
    ? pt
      ? "Configurações"
      : "Settings"
    : pathname.includes("/agents")
      ? pt
        ? "Agente"
        : "Agents"
      : pathname === base
        ? "Home"
        : "Elo";
  const active = (href: string) =>
    href === base
      ? pathname === base
      : pathname.startsWith(href) ||
        (href.endsWith("/elo") &&
          ["/wake", "/guide", "/live"].some((p) =>
            pathname.startsWith(base + p),
          ));
  return (
    <div className={"app-shell refined-shell " + (open ? "menu-open" : "")}>
      <button
        className="sidebar-scrim"
        aria-label={pt ? "Fechar menu" : "Close menu"}
        onClick={() => setOpen(false)}
      />
      <aside className="sidebar">
        <Link href={base} className="logo" onClick={() => setOpen(false)}>
          myn<span>.</span>
        </Link>
        <nav aria-label={pt ? "Navegação principal" : "Main navigation"}>
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={"nav-link " + (active(href) ? "selected" : "")}
              aria-current={active(href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            href={base + "/settings"}
            className={"nav-link " + (settings ? "selected" : "")}
            aria-current={settings ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <Settings size={19} />
            {pt ? "Configurações" : "Settings"}
          </Link>
          <div className="account-row">
            <span className="avatar">{email[0]?.toUpperCase()}</span>
            <span>
              {preview ? (pt ? "Visitante" : "Guest") : email.split("@")[0]}
            </span>
            <button
              className="icon-button"
              title={pt ? "Sair" : "Sign out"}
              aria-label={pt ? "Sair" : "Sign out"}
              onClick={async () => {
                if (!preview) await browserDb().auth.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="app-header">
          <div className="header-location">
            <button
              className="mobile-menu icon-button"
              aria-label={pt ? "Abrir menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span>{title}</span>
          </div>
          {pathname !== base && (
            <button
              className="new-conversation"
              title={pt ? "Nova conversa" : "New conversation"}
              onClick={() => router.push(base + "/elo?new=" + Date.now())}
            >
              <Plus size={17} />
              <span>{pt ? "Nova conversa" : "New conversation"}</span>
            </button>
          )}
        </header>
        <main className="app-content">
          {preview && (
            <div className="preview-note">
              {pt
                ? "Conheça seu espaço. Entre para continuar uma conversa."
                : "Explore your space. Sign in to start a conversation."}
              <Link href="/login">{pt ? "Entrar" : "Sign in"} →</Link>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
