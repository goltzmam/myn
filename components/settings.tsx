"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { browserDb } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/stores/preferences";
export function Settings({ section = "account" }: { section?: string }) {
  const { language, setLanguage, speechLanguage, setSpeechLanguage } =
      usePreferences(),
    pt = language === "pt-BR",
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    media = useRef<MediaStream>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const client = browserDb();
        const {
          data: { user },
        } = await client.auth.getUser();
        if (user) {
          const { data, error } = await client
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
          if (error) throw error;
          if (live) setName(data?.full_name || "");
        }
      } catch {
        if (live)
          setStatus(
            pt
              ? "Não foi possível carregar suas preferências."
              : "Could not load your preferences.",
          );
      }
    })();
    return () => {
      live = false;
      media.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pt]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const client = browserDb();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user)
        throw new Error(pt ? "Entre novamente." : "Please sign in again.");
      const { error } = await client
        .from("profiles")
        .update({ full_name: name, language })
        .eq("id", user.id);
      if (error) throw error;
      if (password) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
      }
      setStatus(pt ? "Tudo salvo." : "All saved.");
    } catch {
      setStatus(
        pt
          ? "Não foi possível salvar. Tente novamente."
          : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function testMic() {
    setStatus("");
    try {
      media.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      media.current = stream;
      setDevices(await navigator.mediaDevices.enumerateDevices());
      timer.current = setTimeout(
        () => stream.getTracks().forEach((t) => t.stop()),
        3000,
      );
      setStatus(
        pt
          ? "Microfone conectado. O teste termina em três segundos."
          : "Microphone connected. The test ends in three seconds.",
      );
    } catch {
      setStatus(
        pt
          ? "Permita o microfone no seu navegador."
          : "Allow microphone access in your browser.",
      );
    }
  }
  return (
    <div className="settings-panel">
      {section === "account" && (
        <form onSubmit={save}>
          <h2>{pt ? "Seu perfil" : "Your profile"}</h2>
          <label>
            {pt ? "Como podemos chamar você?" : "What should we call you?"}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </label>
          <label>
            {pt ? "Idioma da interface" : "Interface language"}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "pt-BR")}
            >
              <option value="en">English</option>
              <option value="pt-BR">Português</option>
            </select>
          </label>
          <label>
            {pt ? "Nova senha" : "New password"}
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                pt
                  ? "Deixe em branco para manter a atual"
                  : "Leave blank to keep your current password"
              }
            />
          </label>
          <Button disabled={busy || (!!password && password.length < 8)}>
            {busy
              ? pt
                ? "Salvando…"
                : "Saving…"
              : pt
                ? "Salvar alterações"
                : "Save changes"}
          </Button>
        </form>
      )}
      {section === "audio" && (
        <>
          <h2>{pt ? "Converse do seu jeito." : "Speak your way."}</h2>
          <p>
            {pt
              ? "O Elo acompanha seu idioma. A escuta pausa enquanto você recebe uma resposta."
              : "Elo follows your language. Listening pauses while you receive a reply."}
          </p>
          <label>
            {pt ? "Idioma da conversa" : "Conversation language"}
            <input
              value={speechLanguage}
              maxLength={35}
              onChange={(e) => setSpeechLanguage(e.target.value)}
              placeholder="auto"
            />
            <small>
              {pt
                ? "auto para detectar seu idioma, ou um código como pt-BR, en, es, ja."
                : "Use auto to follow your language, or a code like en, es, ja."}
            </small>
          </label>
          <Button variant="secondary" onClick={testMic}>
            {pt ? "Testar microfone" : "Test microphone"}
          </Button>
          {devices
            .filter((d) => d.kind === "audioinput")
            .map((d) => (
              <p key={d.deviceId}>{d.label}</p>
            ))}
          <Link href="/app/elo">{pt ? "Abrir Elo" : "Open Elo"} →</Link>
        </>
      )}
      {section === "privacy" && (
        <>
          <h2>
            {pt ? "Suas conversas são suas." : "Your conversations are yours."}
          </h2>
          <p>
            {pt
              ? "Seu histórico guarda textos, transcrições e resumos. Imagens da tela e arquivos de áudio não ficam armazenados no MYN. Você escolhe o que compartilhar e pode parar a qualquer momento."
              : "History keeps text, transcripts and summaries. MYN does not retain screenshots or audio recordings. You choose what to share and can stop at any time."}
          </p>
          <Link href="/app/settings/history">
            {pt
              ? "Revisar e exportar conversas"
              : "Review and export conversations"}{" "}
            →
          </Link>
          <div className="danger-zone">
            <h3>{pt ? "Gerenciar seus dados" : "Manage your data"}</h3>
            <Button
              variant="secondary"
              onClick={async () => {
                if (
                  !confirm(
                    pt
                      ? "Apagar todo o histórico? Esta ação não pode ser desfeita."
                      : "Permanently delete all conversation history?",
                  )
                )
                  return;
                const client = browserDb();
                const {
                  data: { user },
                } = await client.auth.getUser();
                const { error } = await client
                  .from("sessions")
                  .delete()
                  .eq("user_id", user?.id);
                setStatus(
                  error
                    ? pt
                      ? "Não foi possível apagar."
                      : "Could not delete."
                    : pt
                      ? "Histórico apagado."
                      : "History deleted.",
                );
              }}
            >
              {pt ? "Apagar histórico" : "Delete history"}
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (
                  !confirm(
                    pt
                      ? "Excluir sua conta e todos os dados? Esta ação não pode ser desfeita."
                      : "Permanently delete your account and all associated data?",
                  )
                )
                  return;
                const res = await fetch("/api/account", { method: "DELETE" });
                if (res.ok) {
                  await browserDb().auth.signOut();
                  location.href = "/";
                } else {
                  const d = await res.json();
                  setStatus(
                    d.code === "ACTIVE_SUBSCRIPTION"
                      ? pt
                        ? "Encerre sua assinatura antes de excluir a conta."
                        : "Cancel your subscription before deleting your account."
                      : pt
                        ? "Não foi possível excluir sua conta. Tente novamente."
                        : "Could not delete your account. Please retry.",
                  );
                }
              }}
            >
              {pt ? "Excluir conta" : "Delete account"}
            </Button>
          </div>
        </>
      )}
      <p role="status">{status}</p>
    </div>
  );
}
