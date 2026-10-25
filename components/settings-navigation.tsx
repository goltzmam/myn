"use client";
import Link from "next/link";
import { usePreferences } from "@/stores/preferences";
import {
  UserRound,
  Volume2,
  ShieldCheck,
  CreditCard,
  History,
} from "lucide-react";
export function SettingsNavigation({
  section,
  base = "/app",
}: {
  section: string;
  base?: string;
}) {
  const pt = usePreferences((s) => s.language) === "pt-BR";
  return (
    <>
      <div className="settings-intro">
        <h1>{pt ? "Do seu jeito." : "Make it yours."}</h1>
        <p>
          {pt
            ? "Seu perfil, suas conversas, suas preferências."
            : "Your profile, conversations and preferences."}
        </p>
      </div>
      <nav
        className="settings-navigation"
        aria-label={pt ? "Seções de configurações" : "Settings sections"}
      >
        {[
          ["account", pt ? "Conta" : "Account", UserRound],
          ["audio", pt ? "Voz e idioma" : "Voice & language", Volume2],
          ["privacy", pt ? "Privacidade" : "Privacy", ShieldCheck],
          ["billing", pt ? "Assinatura" : "Subscription", CreditCard],
          ["history", pt ? "Histórico" : "History", History],
        ].map(([key, title, Icon]) => {
          const I = Icon as typeof UserRound;
          return (
            <Link
              key={String(key)}
              href={base + "/settings/" + key}
              className={section === key ? "active" : ""}
              aria-current={section === key ? "page" : undefined}
            >
              <I size={16} />
              {String(title)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
