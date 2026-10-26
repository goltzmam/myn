"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import {
  Eye,
  Mic,
  Square,
  ArrowUp,
  Pause,
  Play,
  Minimize2,
  Maximize2,
  Volume2,
  Globe2,
  Download,
  Check,
  LoaderCircle,
  RefreshCw,
  SlidersHorizontal,
  Copy,
  MessageSquare,
  VolumeX,
  X,
} from "lucide-react";
import { ConversationPresence } from "@/components/conversation-presence";
import { browserDb } from "@/lib/auth/client";
import { frame } from "@/lib/vision/capture";
import { usePreferences } from "@/stores/preferences";
import { translations } from "@/lib/i18n";
import { conversationLanguageSchema } from "@/lib/guide";
import { useMentorVoice } from "@/hooks/use-mentor-voice";
import {
  request,
  readConversation,
  problem,
  type ConversationProblem,
} from "@/lib/conversation-client";
import { playToCompletion } from "@/lib/audio/playback";
import { nextSpeechChunk } from "@/lib/audio/sentences";
type Message = {
  role: "user" | "assistant";
  content: string;
  turn?: string;
  saved?: boolean;
};
type Phase = "idle" | "opening" | "transcribing" | "thinking" | "speaking";
export function Session({
  mode,
  compact = false,
  initialMessage,
  draftKey,
  intent,
}: {
  mode: "wake" | "guide" | "live";
  compact?: boolean;
  initialMessage?: string;
  draftKey?: string;
  intent?: string;
}) {
  const { language, speechLanguage, setSpeechLanguage } = usePreferences(),
    pt = language === "pt-BR",
    t = translations[language];
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(initialMessage || ""),
    [phase, setPhase] = useState<Phase>("idle"),
    [busy, setBusy] = useState(false),
    [sessionId, setSessionId] = useState<string>(),
    [sharing, setSharing] = useState(false),
    [paused, setPaused] = useState(false),
    [minimized, setMinimized] = useState(false),
    [error, setError] = useState<ConversationProblem>(),
    [audioError, setAudioError] = useState(""),
    [speak, setSpeak] = useState(!compact),
    [audioUrl, setAudioUrl] = useState<string>(),
    [lastReply, setLastReply] = useState(""),
    [notice, setNotice] = useState(""),
    [immersive, setImmersive] = useState(false),
    [transcriptOpen, setTranscriptOpen] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    media = useRef<MediaStream>(null),
    player = useRef<HTMLAudioElement>(null),
    audioObject = useRef<string>(null),
    scroll = useRef<HTMLDivElement>(null),
    followMessages = useRef(true),
    textarea = useRef<HTMLTextAreaElement>(null),
    id = useRef<string | undefined>(undefined),
    idTask = useRef<Promise<string>>(null),
    abort = useRef<AbortController>(null),
    task = useRef<Promise<void>>(null),
    locked = useRef(false),
    alive = useRef(true),
    speechEpoch = useRef(0),
    welcomeDone = useRef(false),
    voiceWanted = useRef(false),
    launched = useRef(false),
    failedTurn = useRef<{ text: string; turnId: string } | undefined>(
      undefined,
    ),
    screenState = useRef({ sharing, paused }),
    options = useRef({ speak, speechLanguage });
  screenState.current = { sharing, paused };
  options.current = { speak, speechLanguage };
  function report(e: unknown) {
    if ((e as Error)?.name === "AbortError") return;
    const data = e as ConversationProblem;
    setError(
      data.code
        ? problem(
            {
              code: data.code,
              error: data.message,
              questionSaved: data.questionSaved,
              turnId: data.turnId,
            },
            language,
          )
        : Object.assign(new Error(data.message || t.error), {
            code: "REQUEST_FAILED",
          }),
    );
  }
  async function json(url: string, init: RequestInit, signal: AbortSignal) {
    return (await request(url, init, language, signal)).json();
  }
  async function ensureSession(objective: string, signal: AbortSignal) {
    if (id.current) return id.current;
    if (idTask.current) return idTask.current;
    idTask.current = (async () => {
      const agentId = new URLSearchParams(location.search).get("agent");
      const data = await json(
        "/api/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            objective,
            ...(agentId ? { agentId } : {}),
          }),
        },
        signal,
      );
      id.current = data.id;
      setSessionId(data.id);
      return data.id as string;
    })();
    try {
      return await idTask.current;
    } finally {
      idTask.current = null;
    }
  }
  function unlockAudio() {
    if (!player.current || player.current.src) return;
    const data = new Uint8Array(844),
      v = new DataView(data.buffer);
    const word = (i: number, s: string) =>
      [...s].forEach((c, j) => v.setUint8(i + j, c.charCodeAt(0)));
    word(0, "RIFF");
    v.setUint32(4, 836, true);
    word(8, "WAVE");
    word(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true);
    v.setUint32(28, 16000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    word(36, "data");
    v.setUint32(40, 800, true);
    audioObject.current = URL.createObjectURL(
      new Blob([data], { type: "audio/wav" }),
    );
    player.current.src = audioObject.current;
    void player.current.play().catch(() => {});
  }
  async function speakChunk(
    text: string,
    session: string,
    signal: AbortSignal,
    expectedEpoch = speechEpoch.current,
  ) {
    const response = await request(
      "/api/audio",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session,
          text,
          language: options.current.speechLanguage,
        }),
      },
      language,
      signal,
    );
    const blob = await response.blob();
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (expectedEpoch !== speechEpoch.current) return;
    player.current?.pause();
    if (audioObject.current) URL.revokeObjectURL(audioObject.current);
    const url = URL.createObjectURL(blob);
    audioObject.current = url;
    setAudioUrl(url);
    if (!player.current) return;
    player.current.src = url;
    setPhase("speaking");
    const played = await playToCompletion(player.current, signal);
    if (!played) {
      voiceWanted.current = false;
      voice.stop();
      throw problem(
        {
          code: "AUDIO_BLOCKED",
          error:
            "Your browser blocked autoplay. Press play to listen, then tap the microphone to continue.",
        },
        language,
      );
    }
  }
  function updateAssistant(turnId: string, content: string, saved = false) {
    setMessages((items) => {
      const found = items.some(
        (m) => m.turn === turnId && m.role === "assistant",
      );
      return found
        ? items.map((m) =>
            m.turn === turnId && m.role === "assistant"
              ? { ...m, content, saved }
              : m,
          )
        : [...items, { role: "assistant", content, turn: turnId, saved }];
    });
  }
  async function runTurn(
    text: string,
    {
      welcome = false,
      turnId = crypto.randomUUID(),
    }: { welcome?: boolean; turnId?: string } = {},
  ) {
    if (locked.current || (!welcome && !text.trim())) return;
    const selected = conversationLanguageSchema.safeParse(
      options.current.speechLanguage,
    );
    if (!selected.success) {
      setError(
        problem(
          {
            code: "INVALID_REQUEST",
            error: "Choose a valid conversation language.",
          },
          language,
        ),
      );
      return;
    }
    locked.current = true;
    followMessages.current = true;
    setBusy(true);
    setPhase(welcome ? "opening" : "thinking");
    setError(undefined);
    setAudioError("");
    abort.current = new AbortController();
    const signal = abort.current.signal;
    let received = "",
      spoken = 0,
      canSpeak = options.current.speak,
      speechTail = Promise.resolve(),
      saved = false,
      streamedChunks = 0;
    const epoch = speechEpoch.current;
    if (!welcome) {
      setInput("");
      setMessages((items) =>
        items.some((m) => m.role === "user" && m.turn === turnId)
          ? items
          : [
              ...items,
              { role: "user", content: text, turn: turnId, saved: false },
            ],
      );
    }
    const enqueue = (chunk: string, session: string) => {
      speechTail = speechTail.then(async () => {
        if (signal.aborted || !canSpeak || epoch !== speechEpoch.current)
          return;
        try {
          await speakChunk(chunk, session, signal, epoch);
        } catch (e) {
          if ((e as Error).name === "AbortError") throw e;
          canSpeak = false;
          voiceWanted.current = false;
          voice.stop();
          setAudioError((e as Error).message || t.error);
        }
      });
      void speechTail.catch(() => {});
    };
    try {
      const session = await ensureSession(
        welcome ? "Voice conversation" : text,
        signal,
      );
      const state = screenState.current;
      const image =
        state.sharing && !state.paused && video.current
          ? await frame(video.current)
          : undefined;
      // All Elo turns, including vision, stream through the same authenticated endpoint.
      if (!compact && mode === "guide" && !welcome) {
        const result = await json(
          "/api/assist",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session,
              turnId,
              message: text,
              image,
              language: selected.data,
            }),
          },
          signal,
        );
        received = result.reply;
        saved = result.saved === true;
        updateAssistant(turnId, received, saved);
        setMessages((items) =>
          items.map((m) => (m.turn === turnId ? { ...m, saved } : m)),
        );
      } else {
        const response = await request(
          "/api/chat",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session,
              turnId,
              message: text,
              kind: welcome ? "welcome" : "message",
              image,
              language: selected.data,
              locale: navigator.language || language,
              screenAvailable: !!navigator.mediaDevices?.getDisplayMedia,
            }),
          },
          language,
          signal,
        );
        await readConversation(
          response,
          (event) => {
            if (event.accepted && event.questionSaved)
              setMessages((items) =>
                items.map((m) =>
                  m.turn === turnId && m.role === "user"
                    ? { ...m, saved: true }
                    : m,
                ),
              );
            if (event.delta) {
              received += event.delta;
              updateAssistant(turnId, received);
              if (canSpeak && streamedChunks < 1) {
                let chunk = nextSpeechChunk(received.slice(spoken));
                if (chunk) {
                  spoken += chunk.length;
                  streamedChunks++;
                  enqueue(chunk, session);
                }
              }
            }
            if (event.done) {
              saved = event.saved === true;
              setMessages((items) =>
                items.map((m) => (m.turn === turnId ? { ...m, saved } : m)),
              );
              if (event.warning)
                setNotice(
                  problem(
                    { code: event.warning.code, error: event.warning.message },
                    language,
                  ).message,
                );
            }
          },
          signal,
          language,
        );
      }
      if (welcome) welcomeDone.current = true;
      failedTurn.current = undefined;
      setLastReply(received);
      if (canSpeak) {
        let chunk;
        while ((chunk = nextSpeechChunk(received.slice(spoken), true))) {
          spoken += chunk.length;
          enqueue(chunk, session);
        }
        await speechTail;
      }
      if (!saved)
        setNotice(
          pt
            ? "A resposta não foi confirmada no histórico. Você pode exportar uma cópia."
            : "This reply was not confirmed saved. You can export a copy.",
        );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const failure = e as ConversationProblem;
        if (failure.questionSaved)
          setMessages((items) =>
            items.map((m) =>
              m.turn === turnId && m.role === "user"
                ? { ...m, saved: true }
                : m,
            ),
          );
        if (!welcome) failedTurn.current = { text, turnId };
        report(e);
      }
      throw e;
    } finally {
      locked.current = false;
      if (alive.current) {
        setBusy(false);
        setPhase("idle");
      }
    }
  }
  function turn(text: string, opts?: { welcome?: boolean; turnId?: string }) {
    const pending = runTurn(text, opts);
    task.current = pending;
    return pending;
  }
  const voice = useMentorVoice({
    async onUtterance(file) {
      setBusy(true);
      setPhase("transcribing");
      setError(undefined);
      abort.current = new AbortController();
      const signal = abort.current.signal;
      try {
        const session = await ensureSession("Voice conversation", signal);
        const data = new FormData();
        data.set("sessionId", session);
        data.set("language", options.current.speechLanguage);
        data.set("audio", file);
        const result = await json(
          "/api/audio",
          { method: "POST", body: data },
          signal,
        );
        await turn(result.text);
      } finally {
        if (alive.current) {
          setBusy(false);
          setPhase("idle");
        }
      }
    },
    onError: (e) => {
      voiceWanted.current = false;
      report(e);
    },
  });
  function interrupt() {
    voiceWanted.current = false;
    voice.stop();
    abort.current?.abort();
    player.current?.pause();
    setPhase("idle");
  }
  async function startVoice(continuous = true, skipWelcome = false) {
    unlockAudio();
    if (compact && !voice.active) setImmersive(true);
    if (voice.active) {
      interrupt();
      return;
    }
    abort.current?.abort();
    player.current?.pause();
    await task.current?.catch(() => {});
    setError(undefined);
    setAudioError("");
    voiceWanted.current = true;
    setSpeak(true);
    options.current.speak = true;
    abort.current = new AbortController();
    try {
      await ensureSession("Voice conversation", abort.current.signal);
      await voice.start(continuous, async () => {
        if (compact && !skipWelcome && !welcomeDone.current) {
          await turn("", { welcome: true });
        }
      });
    } catch (e) {
      voiceWanted.current = false;
      voice.stop();
      report(e);
    }
  }
  async function submit(text = input) {
    unlockAudio();
    const resume = voice.active;
    voice.stop();
    player.current?.pause();
    if (locked.current) {
      abort.current?.abort();
      await task.current?.catch(() => {});
    }
    try {
      await turn(text);
      if (resume && voiceWanted.current) await startVoice(true, true);
    } catch {
      voiceWanted.current = false;
      voice.stop();
    }
  }
  async function changeLanguage(value: string) {
    speechEpoch.current++;
    setSpeechLanguage(value);
    options.current.speechLanguage = value;
    setNotice(
      pt
        ? "O novo idioma será usado na próxima resposta."
        : "Your next answer will use the new language.",
    );
    if (phase === "speaking") {
      player.current?.pause();
    }
  }
  function stopScreen() {
    media.current?.getTracks().forEach((track) => track.stop());
    media.current = null;
    screenState.current = { sharing: false, paused: false };
    setSharing(false);
    setPaused(false);
    if (video.current) video.current.srcObject = null;
  }
  async function share() {
    setError(undefined);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia)
        throw new Error(
          pt
            ? "Este navegador não permite compartilhar a tela. Você pode continuar por voz ou texto."
            : "This browser cannot share a screen. You can continue by voice or text.",
        );
      const captureOptions: DisplayMediaStreamOptions & {
        selfBrowserSurface: string;
        surfaceSwitching: string;
      } = {
        video: { frameRate: 2 },
        audio: false,
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
      };
      const stream =
        await navigator.mediaDevices.getDisplayMedia(captureOptions);
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      media.current = stream;
      stream.getVideoTracks()[0].onended = stopScreen;
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play();
      }
      screenState.current = { sharing: true, paused: false };
      setSharing(true);
      setMinimized((window.visualViewport?.height || window.innerHeight) < 430);
    } catch (e) {
      stopScreen();
      report(e);
    }
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      voiceWanted.current = false;
      abort.current?.abort();
      media.current?.getTracks().forEach((t) => t.stop());
      player.current?.pause();
      if (audioObject.current) URL.revokeObjectURL(audioObject.current);
    };
  }, []);
  useEffect(() => {
    const draft = draftKey;
    const timer = setTimeout(() => {
      if (!compact || !draft || launched.current) return;
      const key = "myn-draft:" + draft;
      const content = sessionStorage.getItem(key);
      if (content) {
        sessionStorage.removeItem(key);
        launched.current = true;
        void submit(content.slice(0, 4000));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const session = new URLSearchParams(location.search).get("session");
    if (!session) return;
    setBusy(true);
    void (async () => {
      try {
        const client = browserDb();
        const current = await client
          .from("sessions")
          .select("id")
          .eq("id", session)
          .single();
        if (current.error || !current.data)
          throw new Error("Session unavailable");
        const updated = await client
          .from("sessions")
          .update({
            status: "active",
            resumed_at: new Date().toISOString(),
            ended_at: null,
          })
          .eq("id", session);
        if (updated.error) throw updated.error;
        const result = await client
          .from("messages")
          .select("role,content,turn_id")
          .eq("session_id", session)
          .order("created_at", { ascending: false })
          .limit(150);
        if (result.error) throw result.error;
        if (alive.current) {
          id.current = session;
          setSessionId(session);
          const list = (result.data || []).reverse().map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            turn: m.turn_id,
            saved: true,
          }));
          setMessages(list);
          welcomeDone.current = list.some((m) => m.role === "assistant");
        }
      } catch (e) {
        if (alive.current) report(e);
      } finally {
        if (alive.current) setBusy(false);
      }
    })();
  }, []);
  useEffect(() => {
    const list = scroll.current;
    if (list && followMessages.current)
      list.scrollTo?.({ top: list.scrollHeight, behavior: "auto" });
  }, [messages, phase]);
  useEffect(() => {
    const node = textarea.current?.closest(".main-shell") as HTMLElement | null;
    const viewport = window.visualViewport;
    if (!node || !viewport) return;
    const resize = () => {
      node.style.setProperty("--elo-height", viewport.height + "px");
      if (viewport.height < 430) setMinimized(true);
    };
    resize();
    viewport.addEventListener("resize", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      node.style.removeProperty("--elo-height");
    };
  }, []);
  useEffect(() => {
    if (!immersive) return;
    const room = document.querySelector<HTMLElement>(
      ".conversation-room.is-immersive",
    );
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    room?.querySelector<HTMLButtonElement>(".presence-view-toggle")?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Tab" && room) {
        const controls = Array.from(
          room.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select, textarea, summary, [tabindex="0"]',
          ),
        ).filter((node) => node.getClientRects().length > 0);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      if (event.key === "Escape") {
        setImmersive(false);
        setTranscriptOpen(false);
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [immersive]);
  async function replay(text: string) {
    if (!id.current) return;
    interrupt();
    await task.current?.catch(() => {});
    abort.current = new AbortController();
    const signal = abort.current.signal;
    try {
      let rest = text;
      while (rest) {
        const chunk = nextSpeechChunk(rest, true);
        if (!chunk) break;
        await speakChunk(chunk, id.current, signal);
        rest = rest.slice(chunk.length);
      }
    } catch (e) {
      report(e);
    } finally {
      setPhase("idle");
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
    const a = document.createElement("a");
    a.href = url;
    a.download = "myn-conversation.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  const active = voice.active || busy || phase !== "idle";
  const status = voice.listening
    ? pt
      ? "Pode falar. Estou ouvindo."
      : "Go ahead. I’m listening."
    : phase === "opening"
      ? pt
        ? "Preparando sua conversa…"
        : "Getting your conversation ready…"
      : phase === "transcribing"
        ? pt
          ? "Ouvindo sua pergunta…"
          : "Understanding your question…"
        : phase === "speaking"
          ? pt
            ? "Falando com você…"
            : "Speaking with you…"
          : busy
            ? pt
              ? "Preparando a resposta…"
              : "Preparing your answer…"
            : pt
              ? "Pronto para conversar"
              : "Ready to talk";
  const allSaved = messages.length > 0 && messages.every((m) => m.saved);
  const showSetup = [
    "AI_NOT_CONFIGURED",
    "AI_AUTH_FAILED",
    "AI_CREDITS_REQUIRED",
    "SERVICE_NOT_CONFIGURED",
  ].includes(error?.code || "");
  return (
    <div
      role={immersive ? "dialog" : undefined}
      aria-modal={immersive ? true : undefined}
      aria-label={
        immersive
          ? pt
            ? "Conversa imersiva"
            : "Immersive conversation"
          : undefined
      }
      className={
        "elo-session conversation-room " +
        (sharing ? "is-sharing " : "") +
        (messages.length ? "has-messages " : "") +
        (compact ? "presence-enabled " : "") +
        (immersive ? "is-immersive " : "") +
        (transcriptOpen ? "transcript-open" : "")
      }
    >
      {compact && (!messages.length || immersive) && (
        <ConversationPresence
          state={
            voice.listening
              ? "listening"
              : phase === "speaking"
                ? "speaking"
                : busy
                  ? "thinking"
                  : "ready"
          }
          level={voice.level}
        />
      )}
      {compact && (
        <div className="presence-topbar">
          {immersive && (
            <span className="presence-wordmark">
              myn<span>.</span>
            </span>
          )}
          <button
            type="button"
            className="presence-view-toggle"
            aria-label={
              immersive
                ? pt
                  ? "Sair do modo imersivo"
                  : "Exit immersive mode"
                : pt
                  ? "Abrir modo imersivo"
                  : "Open immersive mode"
            }
            title={
              immersive
                ? pt
                  ? "Voltar à conversa"
                  : "Back to conversation"
                : pt
                  ? "Modo imersivo"
                  : "Immersive mode"
            }
            onClick={() => {
              setImmersive(!immersive);
              if (immersive) setTranscriptOpen(false);
            }}
          >
            {immersive ? <X size={23} /> : <Maximize2 size={18} />}
          </button>
        </div>
      )}
      {immersive && (
        <div className="presence-caption" role="status">
          <p>
            {voice.active || busy
              ? status
              : pt
                ? "Estou por aqui."
                : "I’m right here."}
          </p>
          <span>
            {voice.active || busy
              ? sharing
                ? pt
                  ? "Vendo com você"
                  : "Looking with you"
                : ""
              : pt
                ? "Toque no microfone. Vamos conversar."
                : "Tap the microphone. Let’s talk."}
          </span>
        </div>
      )}
      <div className={"elo-stage " + (sharing ? "with-screen" : "")}>
        <section
          className={
            "shared-screen-panel " +
            (sharing ? "" : "screen-off") +
            (minimized ? " preview-minimized" : "")
          }
          aria-label={pt ? "Tela compartilhada" : "Shared screen"}
        >
          <div className="shared-screen-header">
            <span>
              <span className="status-dot" />
              {paused
                ? pt
                  ? "Visualização pausada"
                  : "Screen paused"
                : pt
                  ? "Vendo juntos"
                  : "Looking together"}
            </span>
            <div>
              <button
                onClick={() => {
                  screenState.current.paused = !paused;
                  setPaused(!paused);
                }}
                aria-label={paused ? t.resume : t.pause}
                title={paused ? t.resume : t.pause}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
              <button
                onClick={() => setMinimized(!minimized)}
                aria-label={
                  minimized
                    ? pt
                      ? "Expandir tela"
                      : "Expand screen"
                    : pt
                      ? "Recolher tela"
                      : "Collapse screen"
                }
              >
                {minimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
              <button onClick={stopScreen} aria-label={t.stop} title={t.stop}>
                <Square size={15} />
              </button>
            </div>
          </div>
          <div className="shared-video">
            <video ref={video} muted playsInline />
          </div>
          {sharing && (
            <small>
              {pt
                ? "A tela atual acompanha cada pergunta."
                : "Your current screen accompanies each question."}
            </small>
          )}
        </section>
        <section
          className="conversation-column"
          aria-label={pt ? "Conversa" : "Conversation"}
        >
          <div
            className="conversation-scroll"
            hidden={immersive && !transcriptOpen}
            ref={scroll}
            onScroll={(event) => {
              const list = event.currentTarget;
              followMessages.current =
                list.scrollHeight - list.scrollTop - list.clientHeight < 100;
            }}
            tabIndex={0}
            aria-label={pt ? "Mensagens da conversa" : "Conversation messages"}
          >
            {!messages.length && !busy && (
              <div className="conversation-empty">
                <h1>
                  {pt
                    ? "O que vamos descobrir hoje?"
                    : "What shall we explore today?"}
                </h1>
                <p>
                  {pt
                    ? "Escreva uma ideia ou toque no microfone."
                    : "Write a thought or tap the microphone."}
                </p>
                {intent === "screen" && !sharing && (
                  <button className="empty-intent" onClick={() => void share()}>
                    <Eye size={20} />
                    {pt ? "Vamos olhar juntos" : "Let’s look together"}
                  </button>
                )}
                {compact && !voice.active && (
                  <button
                    className="empty-intent presence-start"
                    onClick={() => void startVoice()}
                  >
                    <Mic size={20} />
                    {pt ? "Vamos conversar" : "Let’s talk"}
                  </button>
                )}
              </div>
            )}
            <div className="conversation-timeline" aria-live="polite">
              {messages.map((m, i) => (
                <article
                  key={m.turn ? m.turn + m.role : i}
                  className={"conversation-message " + m.role}
                >
                  {m.role === "assistant" && (
                    <span className="speaker-mark" aria-label="MYN">
                      m<span>.</span>
                    </span>
                  )}
                  <div className="message-content" dir="auto">
                    {m.role === "assistant" ? (
                      <>
                        <div className="conversation-markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            skipHtml
                            disallowedElements={["img"]}
                            components={{
                              a: ({ node: _node, children, ...props }) => (
                                <a
                                  {...props}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {children}
                                </a>
                              ),
                              table: ({ node: _node, children, ...props }) => (
                                <div className="markdown-table">
                                  <table {...props}>{children}</table>
                                </div>
                              ),
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                        {m.content && !busy && (
                          <div className="message-actions">
                            <button
                              type="button"
                              aria-label={
                                pt ? "Copiar resposta" : "Copy answer"
                              }
                              title={pt ? "Copiar resposta" : "Copy answer"}
                              onClick={() =>
                                void navigator.clipboard
                                  ?.writeText(m.content)
                                  .catch(() =>
                                    setNotice(
                                      pt
                                        ? "Não foi possível copiar."
                                        : "Could not copy.",
                                    ),
                                  )
                              }
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label={
                                pt
                                  ? "Ouvir esta resposta"
                                  : "Listen to this answer"
                              }
                              title={
                                pt
                                  ? "Ouvir esta resposta"
                                  : "Listen to this answer"
                              }
                              onClick={() => void replay(m.content)}
                            >
                              <Volume2 size={14} />
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      m.content
                    )}
                  </div>
                </article>
              ))}
              {busy && phase !== "speaking" && (
                <p role="status" className="conversation-working">
                  <LoaderCircle size={15} className="spin" />
                  {status}
                </p>
              )}
            </div>
          </div>
          <div className="conversation-dock">
            {error && (
              <div className="conversation-error" role="alert">
                <p>{error.message}</p>
                <div>
                  {showSetup && (
                    <Link href="/app/settings/audio">
                      {pt ? "Verificar conexão" : "Check connection"} →
                    </Link>
                  )}
                  {[
                    "DATABASE_NOT_READY",
                    "DATABASE_PERMISSION_DENIED",
                  ].includes(error.code || "") && (
                    <Link href="/app/setup">
                      {pt
                        ? "Ativar mentor e histórico"
                        : "Activate mentor and history"}{" "}
                      →
                    </Link>
                  )}
                  {failedTurn.current && (
                    <button
                      onClick={() =>
                        void turn(failedTurn.current!.text, {
                          turnId: failedTurn.current!.turnId,
                        }).catch(() => {})
                      }
                    >
                      <RefreshCw size={13} />
                      {pt ? "Tentar novamente" : "Retry"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {audioError && (
              <p className="conversation-audio-notice" role="status">
                {audioError}
              </p>
            )}
            {voice.active && !immersive && (
              <div className="conversation-voice-status" role="status">
                <span
                  className="voice-level"
                  style={{ opacity: Math.max(0.4, voice.level / 100) }}
                />
                <span>{status}</span>
                <button onClick={interrupt}>{pt ? "Parar" : "Stop"}</button>
              </div>
            )}
            <form
              className="conversation-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <textarea
                ref={textarea}
                dir="auto"
                aria-label={t.ask}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={pt ? "Pergunte o que quiser" : "Ask anything"}
                maxLength={4000}
                rows={2}
                hidden={immersive && !transcriptOpen}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    if (input.trim() && !busy) void submit();
                  }
                }}
              />
              <div className="conversation-composer-tools">
                <div>
                  {immersive && (
                    <>
                      <button
                        type="button"
                        className={
                          speak ? "presence-sound active" : "presence-sound"
                        }
                        aria-label={
                          pt
                            ? speak
                              ? "Silenciar respostas"
                              : "Ouvir respostas"
                            : speak
                              ? "Mute replies"
                              : "Unmute replies"
                        }
                        aria-pressed={speak}
                        onClick={() => {
                          const next = !speak;
                          setSpeak(next);
                          options.current.speak = next;
                          if (!next) {
                            speechEpoch.current++;
                            player.current?.pause();
                          }
                        }}
                      >
                        {speak ? <Volume2 size={21} /> : <VolumeX size={21} />}
                      </button>
                      <button
                        type="button"
                        className={
                          transcriptOpen
                            ? "presence-transcript active"
                            : "presence-transcript"
                        }
                        aria-label={
                          pt
                            ? "Mostrar conversa e escrever"
                            : "Show conversation and type"
                        }
                        aria-pressed={transcriptOpen}
                        onClick={() => {
                          setTranscriptOpen(!transcriptOpen);
                        }}
                      >
                        <MessageSquare size={21} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={sharing ? "active" : ""}
                    aria-label={sharing ? t.stop : t.share}
                    title={sharing ? t.stop : t.share}
                    onClick={() => (sharing ? stopScreen() : void share())}
                  >
                    <Eye size={20} />
                  </button>
                  <button
                    type="button"
                    className={
                      "presence-mic " + (voice.active ? "active voice-on" : "")
                    }
                    aria-label={
                      voice.active
                        ? pt
                          ? "Parar conversa"
                          : "Stop conversation"
                        : compact
                          ? pt
                            ? "Conversar por voz"
                            : "Talk by voice"
                          : t.listen
                    }
                    title={pt ? "Conversar por voz" : "Talk by voice"}
                    onClick={() => void startVoice(compact)}
                  >
                    {voice.active ? <Square size={17} /> : <Mic size={19} />}
                  </button>
                  <details className="conversation-language">
                    <summary
                      aria-label={pt ? "Alterar idioma" : "Change language"}
                      title={pt ? "Alterar idioma" : "Change language"}
                    >
                      <Globe2 size={17} />
                      <span>
                        {speechLanguage === "auto" ? "Auto" : speechLanguage}
                      </span>
                    </summary>
                    <div>
                      <label>
                        {pt ? "Idioma das respostas" : "Reply language"}
                        <select
                          aria-label={
                            pt ? "Idioma da conversa" : "Conversation language"
                          }
                          value={
                            [
                              "auto",
                              "pt-BR",
                              "en",
                              "es",
                              "fr",
                              "de",
                              "it",
                              "ja",
                              "ko",
                              "zh",
                              "ar",
                              "hi",
                              "ru",
                            ].includes(speechLanguage)
                              ? speechLanguage
                              : "custom"
                          }
                          onChange={(e) => {
                            if (e.target.value !== "custom")
                              void changeLanguage(e.target.value);
                          }}
                        >
                          {[
                            ["auto", pt ? "Automático" : "Automatic"],
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
                            [
                              "custom",
                              pt ? "Outro idioma" : "Another language",
                            ],
                          ].map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {pt
                          ? "Outro código de idioma"
                          : "Another language code"}
                        <input
                          aria-label={pt ? "Código de idioma" : "Language code"}
                          value={speechLanguage}
                          maxLength={35}
                          onChange={(e) => void changeLanguage(e.target.value)}
                        />
                      </label>
                      <small>
                        {pt
                          ? "A fala é transcrita no idioma original. Você pode mudar a resposta a qualquer momento."
                          : "Speech stays in its original language. You can change the reply language at any time."}
                      </small>
                    </div>
                  </details>
                  <details className="conversation-options">
                    <summary
                      aria-label={
                        pt ? "Opções da conversa" : "Conversation options"
                      }
                    >
                      <SlidersHorizontal size={17} />
                    </summary>
                    <div>
                      <label>
                        <input
                          type="checkbox"
                          checked={speak}
                          onChange={(e) => {
                            setSpeak(e.target.checked);
                            options.current.speak = e.target.checked;
                          }}
                        />
                        {t.speak}
                      </label>
                      {sessionId && (
                        <Link href={"/app/settings/history/" + sessionId}>
                          {t.history}
                        </Link>
                      )}
                      {messages.length > 0 && (
                        <button type="button" onClick={exportTranscript}>
                          <Download size={14} />
                          {pt ? "Exportar conversa" : "Export conversation"}
                        </button>
                      )}
                    </div>
                  </details>
                </div>
                {busy || phase === "speaking" ? (
                  <button
                    type="button"
                    className="conversation-send"
                    aria-label={
                      pt ? "Interromper resposta" : "Interrupt response"
                    }
                    title={pt ? "Interromper resposta" : "Interrupt response"}
                    onClick={interrupt}
                  >
                    <Square size={15} />
                  </button>
                ) : (
                  <button
                    className="conversation-send"
                    disabled={!input.trim()}
                    aria-label={t.send}
                    title={t.send}
                  >
                    <ArrowUp size={19} />
                  </button>
                )}
              </div>
            </form>
            <div className="conversation-footer">
              <span>
                {allSaved ? (
                  <>
                    <Check size={12} />
                    {pt
                      ? "Conversa salva no seu histórico privado."
                      : "Conversation saved in your private history."}
                  </>
                ) : sharing ? (
                  pt ? (
                    "Você escolhe o que compartilhar."
                  ) : (
                    "You choose what to share."
                  )
                ) : pt ? (
                  "Um passo de cada vez."
                ) : (
                  "One step at a time."
                )}
              </span>
              {notice && <span role="status">{notice}</span>}
            </div>
            <audio
              ref={player}
              controls
              className={
                audioUrl && audioError ? "conversation-audio" : "hidden"
              }
              aria-label={
                pt ? "Resposta em áudio do mentor" : "Mentor audio response"
              }
            />
            {lastReply && !busy && audioError && (
              <button
                className="replay-response"
                onClick={() => {
                  unlockAudio();
                  if (id.current) {
                    abort.current = new AbortController();
                    void speakChunk(
                      lastReply.slice(0, 4000),
                      id.current,
                      abort.current.signal,
                    ).catch(report);
                  }
                }}
              >
                <Volume2 size={14} />
                {pt ? "Ouvir resposta" : "Play answer"}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
