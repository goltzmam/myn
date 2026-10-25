"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mic,
  Square,
  MonitorUp,
  Send,
  Volume2,
  ShieldCheck,
  Check,
  Pause,
  Play,
  ScanEye,
  AudioLines,
  Radio,
  Download,
} from "lucide-react";
import { browserDb } from "@/lib/auth/client";
import { frame } from "@/lib/vision/capture";
import { Button } from "@/components/ui/button";
import { translations } from "@/lib/i18n";
import { usePreferences } from "@/stores/preferences";
import { errorMessage } from "@/lib/errors";
import { useMentorVoice } from "@/hooks/use-mentor-voice";
import { playToCompletion } from "@/lib/audio/playback";
import { conversationLanguageSchema, type Guidance } from "@/lib/guide";
type Message = {
  role: "user" | "assistant";
  content: string;
  turn?: string;
  saved?: boolean;
};
type Phase = "idle" | "transcribing" | "thinking" | "speaking";
export function Session({ mode }: { mode: "wake" | "guide" | "live" }) {
  const router = useRouter(),
    { language, speechLanguage, setSpeechLanguage } = usePreferences(),
    t = translations[language],
    pt = language === "pt-BR";
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [sessionId, setSessionId] = useState<string>(),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState<Phase>("idle"),
    [error, setError] = useState(""),
    [errorCode, setErrorCode] = useState(""),
    [audioError, setAudioError] = useState(""),
    [sharing, setSharing] = useState(false),
    [paused, setPaused] = useState(false),
    [speak, setSpeak] = useState(true),
    [guidance, setGuidance] = useState<Guidance>(),
    [audioUrl, setAudioUrl] = useState<string>(),
    [lastReply, setLastReply] = useState(""),
    [saved, setSaved] = useState(true);
  const video = useRef<HTMLVideoElement>(null),
    screen = useRef<MediaStream>(null),
    audio = useRef<HTMLAudioElement>(null),
    audioObject = useRef<string>(null),
    abort = useRef<AbortController>(null),
    alive = useRef(true),
    lock = useRef(false),
    idRef = useRef<string>(undefined),
    screenState = useRef({ sharing, paused }),
    options = useRef({ speak, speechLanguage }),
    sessionPromise = useRef<Promise<string>>(null);
  screenState.current = { sharing, paused };
  options.current = { speak, speechLanguage };
  function showError(e: unknown) {
    if (e instanceof Error && e.name === "AbortError") return;
    const problem = e as Error & { code?: string };
    setErrorCode(problem.code || "");
    setError(errorMessage(problem.code, problem.message || t.error, language));
  }
  async function json(url: string, init: RequestInit) {
    const res = await fetch(url, { ...init, signal: abort.current?.signal });
    if (!res.ok) {
      let data;
      try {
        data = await res.json();
      } catch {}
      const e = Object.assign(new Error(data?.error || t.error), {
        code: data?.code,
      });
      throw e;
    }
    return res;
  }
  async function ensureSession(objective: string) {
    if (idRef.current) return idRef.current;
    if (sessionPromise.current) return sessionPromise.current;
    sessionPromise.current = (async () => {
      const agentId = new URLSearchParams(location.search).get("agent");
      const res = await json("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          objective,
          ...(agentId ? { agentId } : {}),
        }),
      });
      const { id } = await res.json();
      idRef.current = id;
      setSessionId(id);
      return id as string;
    })();
    try {
      return await sessionPromise.current;
    } finally {
      sessionPromise.current = null;
    }
  }
  function clearAudio() {
    audio.current?.pause();
    if (audioObject.current) URL.revokeObjectURL(audioObject.current);
    audioObject.current = null;
  }
  // Prime the same audio element during a click; retain controls if autoplay is still denied.
  function unlockAudio() {
    if (!audio.current || audio.current.src) return;
    const bytes = new Uint8Array(44 + 800);
    const view = new DataView(bytes.buffer);
    const text = (offset: number, s: string) =>
      [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    text(0, "RIFF");
    view.setUint32(4, bytes.length - 8, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, 800, true);
    audioObject.current = URL.createObjectURL(
      new Blob([bytes], { type: "audio/wav" }),
    );
    audio.current.src = audioObject.current;
    void audio.current.play().catch(() => {});
  }
  async function say(text: string, id: string) {
    setAudioError("");
    try {
      const response = await json("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: id,
          text,
          language: options.current.speechLanguage,
        }),
      });
      if (!alive.current) return;
      clearAudio();
      const url = URL.createObjectURL(await response.blob());
      audioObject.current = url;
      setAudioUrl(url);
      if (!audio.current) return;
      audio.current.src = url;
      setPhase("speaking");
      setBusy(false);
      const played = await playToCompletion(audio.current);
      if (!played) {
        setAudioError(
          pt
            ? "O navegador bloqueou o início automático. Aperte ▶ no player para ouvir."
            : "Your browser blocked autoplay. Press ▶ in the audio player to listen.",
        );
        voice.stop();
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      const problem = e as Error & { code?: string };
      setAudioError(
        errorMessage(problem.code, problem.message || t.error, language),
      );
      voice.stop();
    } finally {
      if (alive.current) setPhase("idle");
    }
  }
  async function send(question = input) {
    if (!question.trim()) return;
    if (lock.current) {
      if (phase === "speaking") {
        audio.current?.pause();
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (lock.current) {
        setError(
          pt
            ? "Aguarde a resposta atual ou interrompa antes de perguntar."
            : "Please wait for or interrupt the current answer.",
        );
        return;
      }
    }
    const lang = conversationLanguageSchema.safeParse(
      options.current.speechLanguage,
    );
    if (!lang.success) {
      setError(
        pt
          ? "Escolha um código de idioma válido, como pt-BR, es ou auto."
          : "Choose a language code such as en, es, or auto.",
      );
      return;
    }
    lock.current = true;
    setSaved(false);
    setBusy(true);
    setError("");
    setErrorCode("");
    setAudioError("");
    setPhase("thinking");
    audio.current?.pause();
    abort.current = new AbortController();
    const turnId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { role: "user", content: question, turn: turnId, saved: false },
    ]);
    setInput("");
    try {
      const id = await ensureSession(question);
      const state = screenState.current;
      const image =
        state.sharing && !state.paused && video.current
          ? await frame(video.current)
          : undefined;
      let reply = "";
      if (mode === "wake" && !image) {
        const response = await json("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: id,
            message: question,
            language: lang.data,
            turnId,
          }),
        });
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Streaming unavailable");
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "", turn: turnId, saved: false },
        ]);
        let buffer = "",
          done = false,
          persisted = false;
        const decoder = new TextDecoder();
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line) continue;
            const event = JSON.parse(line);
            if (event.error)
              throw Object.assign(new Error(event.error), { code: event.code });
            if (event.delta) {
              reply += event.delta;
              if (alive.current)
                setMessages((m) =>
                  m.map((msg) =>
                    msg.turn === turnId && msg.role === "assistant"
                      ? { ...msg, content: reply }
                      : msg,
                  ),
                );
            }
            if (event.done) {
              done = true;
              persisted = event.saved === true;
              if (event.warning)
                setError(
                  errorMessage(
                    event.warning.code,
                    event.warning.message,
                    language,
                  ),
                );
            }
          }
        }
        if (!done) throw new Error("Response interrupted");
        setSaved(persisted);
        setMessages((m) =>
          m.map((msg) =>
            msg.turn === turnId ? { ...msg, saved: persisted } : msg,
          ),
        );
      } else {
        const response = await json("/api/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: id,
            message: question,
            image,
            language: lang.data,
            turnId,
          }),
        });
        const result = await response.json();
        if (!alive.current) return;
        reply = result.reply;
        setGuidance(result);
        setSaved(result.saved === true);
        setMessages((m) => [
          ...m.map((msg) =>
            msg.turn === turnId
              ? { ...msg, saved: result.saved === true }
              : msg,
          ),
          {
            role: "assistant",
            content: reply,
            turn: turnId,
            saved: result.saved === true,
          },
        ]);
        if (result.warning)
          setError(
            errorMessage(result.warning.code, result.warning.message, language),
          );
      }
      setLastReply(reply);
      setPhase("idle");
      if (options.current.speak) await say(reply, id);
    } catch (e) {
      if (alive.current) {
        showError(e);
        setSaved(false);
      }
      throw e;
    } finally {
      lock.current = false;
      if (alive.current) {
        setBusy(false);
        setPhase("idle");
      }
    }
  }
  const voice = useMentorVoice({
    async onUtterance(file) {
      abort.current = new AbortController();
      setBusy(true);
      setPhase("transcribing");
      setError("");
      try {
        const id = await ensureSession("Voice conversation");
        const form = new FormData();
        form.append("sessionId", id);
        form.append("language", options.current.speechLanguage);
        form.append("audio", file);
        const response = await json("/api/audio", {
          method: "POST",
          body: form,
        });
        const { text } = await response.json();
        setInput(text);
        setBusy(false);
        await send(text);
      } finally {
        if (alive.current) {
          setBusy(false);
          setPhase("idle");
        }
      }
    },
    onError: showError,
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      screen.current?.getTracks().forEach((t) => t.stop());
      audio.current?.pause();
      if (audioObject.current) URL.revokeObjectURL(audioObject.current);
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("session");
    if (!id) return;
    setBusy(true);
    void (async () => {
      try {
        const client = browserDb();
        const { data: session, error } = await client
          .from("sessions")
          .select("id,mode")
          .eq("id", id)
          .single();
        if (error || !session || session.mode !== mode)
          throw new Error("Session unavailable");
        const { error: updateError } = await client
          .from("sessions")
          .update({
            status: "active",
            ended_at: null,
            resumed_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (updateError) throw updateError;
        const { data, error: historyError } = await client
          .from("messages")
          .select("role,content")
          .eq("session_id", id)
          .order("created_at");
        if (historyError) throw historyError;
        if (alive.current) {
          idRef.current = id;
          setSessionId(id);
          setMessages((data || []).map((m) => ({ ...m, saved: true })));
        }
      } catch (e) {
        if (alive.current) showError(e);
      } finally {
        if (alive.current) setBusy(false);
      }
    })();
  }, [mode]);
  function stopScreen() {
    screen.current?.getTracks().forEach((t) => t.stop());
    screen.current = null;
    screenState.current = { sharing: false, paused: false };
    setSharing(false);
    setPaused(false);
    if (video.current) video.current.srcObject = null;
  }
  async function share() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getDisplayMedia)
        throw new Error(
          pt
            ? "Use um navegador desktop compatível e HTTPS."
            : "Use a compatible desktop browser and HTTPS.",
        );
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 2 },
        audio: false,
      });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      screen.current = media;
      media.getVideoTracks()[0].onended = stopScreen;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      screenState.current = { sharing: true, paused: false };
      setSharing(true);
      setPaused(false);
    } catch (e) {
      stopScreen();
      showError(e);
    }
  }
  async function startMentor() {
    unlockAudio();
    audio.current?.pause();
    setError("");
    setAudioError("");
    setSpeak(true);
    options.current.speak = true;
    if (mode === "guide" && !screenState.current.sharing) await share();
    if (mode === "guide" && !screenState.current.sharing) return;
    try {
      abort.current = new AbortController();
      await ensureSession("Voice conversation");
      await voice.start(true);
    } catch (e) {
      showError(e);
    }
  }
  function stopMentor() {
    voice.stop();
    audio.current?.pause();
    abort.current?.abort();
  }
  async function manualMic() {
    unlockAudio();
    audio.current?.pause();
    if (voice.listening) {
      voice.finish();
      return;
    }
    if (voice.active) return;
    try {
      abort.current = new AbortController();
      await ensureSession("Voice conversation");
      await voice.start(false);
    } catch (e) {
      showError(e);
    }
  }
  async function end() {
    stopMentor();
    stopScreen();
    if (sessionId) {
      const { error } = await browserDb()
        .from("sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) {
        showError(error);
        return;
      }
      router.push("/app/history/" + sessionId);
    }
  }
  function exportTranscript() {
    const url = URL.createObjectURL(
      new Blob(
        [
          messages
            .map((m) => (m.role === "user" ? "YOU" : "MYN") + ": " + m.content)
            .join("\n\n"),
        ],
        { type: "text/plain;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "myn-conversation.txt";
    link.click();
    URL.revokeObjectURL(url);
  }
  const status = voice.listening
    ? pt
      ? "Ouvindo sua pergunta…"
      : "Listening to your question…"
    : phase === "transcribing"
      ? pt
        ? "Transcrevendo…"
        : "Transcribing…"
      : phase === "thinking"
        ? pt
          ? "Analisando e preparando a resposta…"
          : "Thinking about your question…"
        : phase === "speaking"
          ? pt
            ? "Seu mentor está falando…"
            : "Your mentor is speaking…"
          : voice.active
            ? pt
              ? "Preparando o microfone…"
              : "Preparing microphone…"
            : t.ready;
  return (
    <>
      <div className="session-heading">
        <div>
          <span className="eyebrow">
            {mode.toUpperCase()} · {status}
          </span>
          <h1>
            {pt ? "Seu mentor, ao seu lado." : "Your mentor, right beside you."}
          </h1>
          <p>
            {pt
              ? "Pergunte por voz ou texto. Compartilhe a tela para receber orientação sobre o que você vê."
              : "Ask by voice or text. Share your screen for guidance on what you see."}
          </p>
        </div>
        <div className="toolbar">
          {sessionId && (
            <Link
              className="button secondary"
              href={"/app/history/" + sessionId}
            >
              {t.history}
            </Link>
          )}
          <Button
            variant="secondary"
            disabled={busy || !sessionId}
            onClick={() => void end()}
          >
            {t.end}
          </Button>
        </div>
      </div>
      <div className="mentor-toolbar surface">
        <div>
          <Button
            disabled={busy && !voice.active}
            onClick={() => (voice.active ? stopMentor() : void startMentor())}
          >
            {voice.active ? <Square size={17} /> : <Mic size={17} />}{" "}
            {voice.active
              ? pt
                ? "Parar mentor"
                : "Stop mentor"
              : pt
                ? "Conversar com mentor"
                : "Talk to your mentor"}
          </Button>
          <span role="status">{status}</span>
        </div>
        <label>
          {pt ? "Idioma da conversa" : "Conversation language"}
          <input
            aria-label={pt ? "Idioma da conversa" : "Conversation language"}
            list="mentor-languages"
            value={speechLanguage}
            maxLength={35}
            onChange={(e) => setSpeechLanguage(e.target.value)}
            disabled={voice.active || busy}
          />
          <datalist id="mentor-languages">
            {[
              ["auto", "Auto — detect spoken language"],
              ["pt-BR", "Português"],
              ["en", "English"],
              ["es", "Español"],
              ["fr", "Français"],
              ["de", "Deutsch"],
              ["it", "Italiano"],
              ["ja", "日本語"],
              ["ko", "한국어"],
              ["zh", "中文"],
              ["ar", "العربية"],
              ["hi", "हिन्दी"],
              ["ru", "Русский"],
            ].map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </datalist>
        </label>
        <small>
          {pt
            ? "Use auto para acompanhar o idioma falado, ou um código de idioma. A qualidade varia conforme o suporte do provedor."
            : "Use auto to follow the spoken language, or enter a language code. Quality varies with provider support."}
        </small>
      </div>
      <div className="session-layout">
        <section className="conversation">
          <div
            className={
              "screen-preview " +
              (mode !== "guide" && !sharing ? "compact" : "")
            }
          >
            <video
              ref={video}
              muted
              playsInline
              className={sharing ? "" : "hidden"}
            />
            {!sharing && (
              <div className="preview-empty">
                {mode === "guide" ? (
                  <ScanEye size={42} />
                ) : mode === "wake" ? (
                  <AudioLines size={42} />
                ) : (
                  <Radio size={42} />
                )}
                <h2>
                  {pt
                    ? "Você escolhe o que compartilhar."
                    : "Choose what your mentor can see."}
                </h2>
                <p>
                  {pt
                    ? "A IA analisa uma imagem atual da tela a cada pergunta."
                    : "A current screen image is analyzed with each question."}
                </p>
              </div>
            )}
            {sharing && (
              <span className="sharing-status">
                <span className="status-dot" />
                {paused
                  ? pt
                    ? "ANÁLISE DE TELA PAUSADA"
                    : "SCREEN ANALYSIS PAUSED"
                  : pt
                    ? "TELA COMPARTILHADA"
                    : "SCREEN SHARING ON"}
              </span>
            )}
          </div>
          <div className="capture-toolbar">
            <Button
              variant="secondary"
              disabled={!sharing && busy}
              onClick={() => (sharing ? stopScreen() : void share())}
            >
              <MonitorUp size={16} />
              {sharing ? t.stop : t.share}
            </Button>
            {sharing && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    screenState.current.paused = !paused;
                    setPaused(!paused);
                  }}
                >
                  {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
                  {paused ? t.resume : t.pause}
                </Button>
                <Button
                  disabled={busy || paused || voice.active}
                  variant="ghost"
                  onClick={() => {
                    unlockAudio();
                    void send(
                      pt
                        ? "Confira a tela atual e me oriente no próximo passo."
                        : "Check the current screen and guide my next step.",
                    ).catch(() => {});
                  }}
                >
                  {t.check}
                </Button>
              </>
            )}
          </div>
          <div className="messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={"message " + m.role}>
                <span>
                  {m.role === "user" ? (pt ? "VOCÊ" : "YOU") : "myn."}
                </span>
                <p dir="auto">{m.content}</p>
              </div>
            ))}
            {busy && (
              <p className="thinking" role="status">
                {status}
              </p>
            )}
          </div>
          {error && (
            <div role="alert" className="notice error">
              {error}
              {["DATABASE_NOT_READY", "DATABASE_PERMISSION_DENIED"].includes(
                errorCode,
              ) && (
                <p>
                  <Link href="/app/setup">
                    {pt
                      ? "Ativar mentor e histórico"
                      : "Activate mentor and history"}{" "}
                    →
                  </Link>
                </p>
              )}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              unlockAudio();
              void send().catch(() => {});
            }}
            className="composer"
          >
            <textarea
              dir="auto"
              aria-label={t.ask}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.ask}
              maxLength={4000}
              disabled={busy || voice.active}
            />
            <div>
              <button
                type="button"
                className={
                  "icon-button " + (voice.listening ? "recording" : "")
                }
                disabled={busy || (voice.active && !voice.listening)}
                onClick={() => void manualMic()}
                aria-label={voice.listening ? t.stopRecord : t.listen}
              >
                {voice.listening ? <Square size={18} /> : <Mic size={18} />}
              </button>
              <span>
                {voice.listening
                  ? pt
                    ? "Fale; envio automático após a pausa."
                    : "Speak; your question sends after a pause."
                  : pt
                    ? "Texto e voz · transcrição no histórico"
                    : "Text & voice · transcripts in history"}
              </span>
              <Button disabled={busy || voice.active || !input.trim()}>
                <Send size={16} />
                {t.send}
              </Button>
            </div>
          </form>
          {voice.active && (
            <div
              className="mic-meter"
              role="meter"
              aria-label="Microphone level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={voice.level}
            >
              <span style={{ width: voice.level + "%" }} />
            </div>
          )}
          <div className="speech-toggle">
            <label>
              <input
                type="checkbox"
                checked={speak}
                onChange={(e) => setSpeak(e.target.checked)}
              />
              {t.speak}
            </label>
            <Button
              variant="ghost"
              disabled={phase !== "speaking" && !voice.active}
              onClick={() => {
                audio.current?.pause();
                if (phase !== "speaking") abort.current?.abort();
              }}
            >
              {pt ? "Interromper resposta" : "Interrupt response"}
            </Button>
          </div>
          <audio
            ref={audio}
            controls
            className={audioUrl ? "mentor-audio" : "hidden"}
            aria-label={
              pt ? "Resposta em áudio do mentor" : "Mentor audio response"
            }
          />
          {audioError && (
            <p role="status" className="notice">
              {audioError}
            </p>
          )}
          {lastReply && !busy && (
            <Button
              variant="ghost"
              onClick={() => {
                unlockAudio();
                if (sessionId) void say(lastReply, sessionId);
              }}
            >
              <Volume2 size={15} />
              {pt ? "Ouvir novamente" : "Listen again"}
            </Button>
          )}
          {messages.length > 0 && (
            <div className="transcript-status">
              <span>
                {saved
                  ? pt
                    ? "Conversa salva no seu histórico privado."
                    : "Conversation saved in your private history."
                  : pt
                    ? "Há mensagens sem confirmação de salvamento. Exporte uma cópia."
                    : "Some messages are not confirmed saved. Export a copy."}
              </span>
              <Button variant="ghost" onClick={exportTranscript}>
                <Download size={15} />
                {pt ? "Exportar conversa" : "Export conversation"}
              </Button>
            </div>
          )}
        </section>
        <aside className="task-panel">
          <span className="eyebrow">{pt ? "SEU MENTOR" : "YOUR MENTOR"}</span>
          <h2>
            {pt
              ? "Uma conversa que acompanha você."
              : "A conversation that stays with you."}
          </h2>
          {guidance?.steps.map((step, i) => (
            <div className={"task-step " + step.status} key={i}>
              <span>
                {step.status === "completed" ? <Check size={14} /> : i + 1}
              </span>
              <div>
                <strong>{step.title}</strong>
                {step.evidence && <small>{step.evidence}</small>}
              </div>
            </div>
          ))}
          {guidance && (
            <>
              <h3>{pt ? "O que está visível" : "Latest observation"}</h3>
              <p dir="auto">{guidance.visible}</p>
              {guidance.uncertainty && (
                <p className="uncertainty" dir="auto">
                  {guidance.uncertainty}
                </p>
              )}
            </>
          )}
          <div className="privacy-note">
            <ShieldCheck size={20} />
            <p>
              {pt
                ? "Suas perguntas, transcrições, respostas e resumo ficam no histórico privado para você revisar. Capturas de tela e arquivos de áudio não são guardados pelo MYN."
                : "Your questions, transcripts, replies and summary are saved privately for review. MYN does not retain screen images or audio files."}
            </p>
            <small>
              {pt
                ? "A voz é gerada por IA. A escuta pausa durante a resposta para evitar retorno de áudio. O microfone encerra ao parar o mentor ou sair."
                : "The voice is AI-generated. Listening pauses while the mentor responds to avoid feedback. Stopping the mentor or leaving releases the microphone."}
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}
