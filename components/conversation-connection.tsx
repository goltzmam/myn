"use client";
import { useState, useEffect } from "react";
import { errorMessage } from "@/lib/errors";
import { usePreferences } from "@/stores/preferences";
export function ConversationConnection() {
  const pt = usePreferences((s) => s.language) === "pt-BR";
  const [status, setStatus] = useState<{
      conversationConfigured: boolean;
      storageReady: boolean;
      deploymentEnvironment?: string;
      revision?: string;
    } | null>(null),
    [failed, setFailed] = useState(false);
  const [probe, setProbe] = useState(""),
    [testing, setTesting] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/conversation/status")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (live) setStatus(data);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="conversation-status-panel">
      <strong>{pt ? "Conexão da conversa" : "Conversation connection"}</strong>
      {!status && !failed && (
        <p>{pt ? "Verificando este site…" : "Checking this site…"}</p>
      )}
      {failed && (
        <p>
          {pt
            ? "Não foi possível verificar. Entre novamente e tente outra vez."
            : "Could not check. Sign in again and retry."}
        </p>
      )}
      {status && (
        <>
          <p>
            {pt ? "Ambiente: " : "Environment: "}
            {status.deploymentEnvironment} · {pt ? "Versão: " : "Version: "}
            {status.revision}
          </p>
          <p>
            {pt ? "Histórico: " : "History: "}
            {status.storageReady
              ? pt
                ? "disponível"
                : "available"
              : pt
                ? "precisa ser ativado"
                : "needs setup"}
          </p>
          <p>
            {pt ? "Credencial do serviço: " : "Service credential: "}
            {status.conversationConfigured
              ? pt
                ? "cadastrada; conexão ainda precisa ser validada"
                : "registered; connectivity still needs validation"
              : pt
                ? "ausente neste site"
                : "missing in this deployment"}
          </p>
          {status.conversationConfigured && (
            <>
              <button
                className="button secondary"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  try {
                    const r = await fetch("/api/conversation/status", {
                      method: "POST",
                    });
                    const d = await r.json();
                    setProbe(
                      r.ok
                        ? pt
                          ? "Conexão confirmada com uma resposta real."
                          : "Connection confirmed with a real response."
                        : errorMessage(d.code, d.error, pt ? "pt-BR" : "en"),
                    );
                  } catch {
                    setProbe(
                      pt ? "Não foi possível testar." : "Could not test.",
                    );
                  } finally {
                    setTesting(false);
                  }
                }}
              >
                {testing
                  ? pt
                    ? "Testando…"
                    : "Testing…"
                  : pt
                    ? "Testar conexão"
                    : "Test connection"}
              </button>
              <small>
                {pt
                  ? "O teste usa uma interação da sua franquia."
                  : "This check uses one interaction from your allowance."}
              </small>
              <p role="status">{probe}</p>
            </>
          )}
          {!status.conversationConfigured && (
            <>
              <p>
                {pt
                  ? "O proprietário precisa conectar o serviço no projeto que publica este site."
                  : "The project owner needs to connect the service in this website’s deployment."}
              </p>
              <ol>
                <li>
                  {pt
                    ? "Abra o projeto MYN na Vercel → Settings → Environment Variables."
                    : "Open MYN in Vercel → Settings → Environment Variables."}
                </li>
                <li>
                  {pt ? "Adicione uma chave válida em " : "Set a valid key in "}
                  <code>MYN_AI_KEY</code>
                  {pt ? " para Production." : " for Production."}
                </li>
                <li>
                  {pt
                    ? "Salve e faça um novo deployment."
                    : "Save and redeploy."}
                </li>
              </ol>
              <small>
                {pt
                  ? "As configurações deste ambiente de desenvolvimento não são copiadas automaticamente para a Vercel. Nunca coloque uma chave no chat ou no código público."
                  : "Development environment secrets are not automatically copied to Vercel. Never paste a key in chat or public code."}
              </small>
            </>
          )}
        </>
      )}
    </section>
  );
}
