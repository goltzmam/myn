"use client";
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { browserDb } from "@/lib/auth/client";
import { frame } from "@/lib/vision/capture";
import { Button } from "@/components/ui/button";
import { translations } from "@/lib/i18n";
import { usePreferences } from "@/stores/preferences";
import type { Guidance } from "@/lib/guide";
type Message = { role: string; content: string };
export function Session({ mode }: { mode: "wake" | "guide" | "live" }) {
  const router = useRouter(),
    language = usePreferences((s) => s.language),
    t = translations[language];
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [sessionId, setSessionId] = useState<string>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sharing, setSharing] = useState(false),
    [paused, setPaused] = useState(false),
    [recording, setRecording] = useState(false),
    [speak, setSpeak] = useState(true),
    [guidance, setGuidance] = useState<Guidance>(),
    [ended, setEnded] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream>(null),
    mic = useRef<MediaStream>(null),
    recorder = useRef<MediaRecorder>(null),
    audio = useRef<HTMLAudioElement>(null),
    abort = useRef<AbortController>(null),
    alive = useRef(true),
    lastRequest = useRef(0),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      mic.current?.getTracks().forEach((t) => t.stop());
      if (recorder.current?.state === "recording") recorder.current.stop();
      audio.current?.pause();
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("session");
    if (!id) return;
    setBusy(true);
    (async () => {
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
        const { data: messages, error: messageError } = await client
          .from("messages")
          .select("role,content")
          .eq("session_id", id)
          .order("created_at");
        if (messageError) throw messageError;
        if (alive.current) {
          setSessionId(id);
          setMessages(messages || []);
        }
      } catch (e) {
        if (alive.current)
          setError(e instanceof Error ? e.message : "Could not resume session");
      } finally {
        if (alive.current) setBusy(false);
      }
    })();
  }, [mode]);
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setSharing(false);
    setPaused(false);
    if (video.current) video.current.srcObject = null;
  }
  async function share() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getDisplayMedia)
        throw new Error(
          "Screen sharing needs a supported desktop browser and HTTPS.",
        );
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: false,
      });
      stream.current = media;
      media.getVideoTracks()[0].onended = () => stop();
      setSharing(true);
      setPaused(false);
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Screen sharing permission denied",
      );
    }
  }
  async function requestJson(url: string, options: RequestInit) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Request failed");
    }
    return res;
  }
  async function say(text: string) {
    audio.current?.pause();
    const response = await requestJson("/api/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const url = URL.createObjectURL(await response.blob());
    const player = new Audio(url);
    audio.current = player;
    player.onended = () => URL.revokeObjectURL(url);
    await player.play();
  }
  async function send(question = input) {
    if (lock.current || !question.trim() || ended) return;
    if (Date.now() - lastRequest.current < 2500) {
      setError("Please wait a moment before checking again.");
      return;
    }
    lock.current = true;
    lastRequest.current = Date.now();
    setBusy(true);
    setError("");
    audio.current?.pause();
    abort.current = new AbortController();
    try {
      const client = browserDb();
      let id = sessionId;
      if (!id) {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user) throw new Error("Please sign in again.");
        const agentId = new URLSearchParams(location.search).get("agent");
        const { data, error } = await client
          .from("sessions")
          .insert({
            user_id: user.id,
            mode,
            title: question.slice(0, 100),
            objective: question,
            ...(agentId ? { agent_id: agentId } : {}),
          })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        setSessionId(id);
      }
      const image =
        sharing && !paused && video.current
          ? await frame(video.current)
          : undefined;
      if (mode === "wake" && !image) {
        const res = await requestJson("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.current.signal,
          body: JSON.stringify({ sessionId: id, message: question, language }),
        });
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Streaming unavailable");
        setMessages((m) => [
          ...m,
          { role: "user", content: question },
          { role: "assistant", content: "" },
        ]);
        setInput("");
        let buffer = "",
          reply = "",
          done = false;
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
            if (event.error) throw new Error(event.error);
            if (event.delta) {
              reply += event.delta;
              if (alive.current)
                setMessages((m) => [
                  ...m.slice(0, -1),
                  { role: "assistant", content: reply },
                ]);
            }
            if (event.done) done = true;
          }
        }
        if (!done) throw new Error("Response interrupted.");
        if (speak && alive.current) await say(reply);
        return;
      }
      const res = await requestJson("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          sessionId: id,
          message: question,
          image,
          language,
        }),
      });
      const data: Guidance = await res.json();
      if (!alive.current) return;
      setMessages((m) => [
        ...m,
        { role: "user", content: question },
        { role: "assistant", content: data.reply },
      ]);
      setInput("");
      setGuidance(data);
      if (speak) await say(data.reply);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : t.error);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setError("");
    audio.current?.pause();
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("Microphone recording is unsupported in this browser.");
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      mic.current = media;
      const chunks: BlobPart[] = [];
      const type = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(media, { mimeType: type });
      recorder.current = rec;
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        if (!alive.current) return;
        setRecording(false);
        setBusy(true);
        try {
          const form = new FormData();
          form.append(
            "audio",
            new File(
              [new Blob(chunks, { type })],
              "question." + (type === "audio/webm" ? "webm" : "mp4"),
              { type },
            ),
          );
          const response = await requestJson("/api/audio", {
            method: "POST",
            body: form,
          });
          const { text } = await response.json();
          setInput(text);
          setBusy(false);
          await send(text);
        } catch (e) {
          setError(e instanceof Error ? e.message : t.error);
        } finally {
          if (alive.current) setBusy(false);
        }
      };
      rec.start();
      setRecording(true);
      setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone permission denied");
    }
  }
  async function end() {
    audio.current?.pause();
    stop();
    if (sessionId) {
      const { error } = await browserDb()
        .from("sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) {
        setError(error.message);
        return;
      }
      setEnded(true);
      router.push("/app/history/" + sessionId);
    }
  }
  return (
    <>
      <div className="session-heading">
        <div>
          <span className="eyebrow">
            {mode.toUpperCase()} · {t.ready}
          </span>
          <h1>
            {mode === "guide"
              ? "A clearer way forward."
              : mode === "wake"
                ? "Good things start with a conversation."
                : "Think freely. Stay present."}
          </h1>
        </div>
        <Button
          variant="secondary"
          disabled={busy || recording || !sessionId}
          onClick={end}
        >
          {t.end}
        </Button>
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
                  {mode === "guide"
                    ? "Your screen. A shared perspective."
                    : t.empty}
                </h2>
                <p>
                  {mode === "guide"
                    ? "Choose exactly what MYN can see. You’re always in control."
                    : "Text or voice. Start wherever you are."}
                </p>
              </div>
            )}
            {sharing && (
              <span className="sharing-status">
                <span className="status-dot" />
                {paused ? "PAUSED — NOT SENDING FRAMES" : "SCREEN SHARING ON"}
              </span>
            )}
          </div>
          <div className="capture-toolbar">
            <Button
              variant="secondary"
              disabled={!sharing && (busy || recording)}
              onClick={sharing ? stop : share}
            >
              <MonitorUp size={16} />
              {sharing ? t.stop : t.share}
            </Button>
            {sharing && (
              <Button variant="ghost" onClick={() => setPaused(!paused)}>
                {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
                {paused ? t.resume : t.pause}
              </Button>
            )}
            {sharing && (
              <Button
                disabled={busy || paused || recording}
                variant="ghost"
                onClick={() =>
                  send(
                    "Check the current screen and verify progress toward my objective.",
                  )
                }
              >
                {t.check}
              </Button>
            )}
          </div>
          <div className="messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={"message " + m.role}>
                <span>{m.role === "user" ? "YOU" : "myn."}</span>
                <p>{m.content}</p>
              </div>
            ))}
            {busy && (
              <p className="thinking" role="status">
                MYN is working on your next step…
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="composer"
          >
            <textarea
              aria-label={t.ask}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.ask}
              maxLength={4000}
              disabled={busy || recording}
            />
            <div>
              <button
                type="button"
                className={"icon-button " + (recording ? "recording" : "")}
                disabled={busy}
                onClick={record}
                aria-label={recording ? t.stopRecord : t.listen}
              >
                {recording ? <Square size={18} /> : <Mic size={18} />}
              </button>
              <span>
                {recording ? "Recording · up to 60 seconds" : "Voice & text"}
              </span>
              <Button disabled={busy || recording || !input.trim()}>
                <Send size={16} />
                {t.send}
              </Button>
            </div>
          </form>
          <label className="speech-toggle">
            <input
              type="checkbox"
              checked={speak}
              onChange={(e) => setSpeak(e.target.checked)}
            />
            <Volume2 size={15} />
            {t.speak}{" "}
            <button
              className="text-button"
              onClick={() => audio.current?.pause()}
            >
              Stop audio
            </button>
          </label>
        </section>
        <aside className="task-panel">
          <span className="eyebrow">YOUR PATH FORWARD</span>
          <h2>One step at a time.</h2>
          {guidance?.steps.length ? (
            guidance.steps.map((step, i) => (
              <div className={"task-step " + step.status} key={i}>
                <span>
                  {step.status === "completed" ? <Check size={14} /> : i + 1}
                </span>
                <div>
                  <strong>{step.title}</strong>
                  {step.evidence && <small>{step.evidence}</small>}
                </div>
              </div>
            ))
          ) : (
            <p>Your task plan will appear after your first question.</p>
          )}
          {guidance && (
            <>
              <h3>Latest observation</h3>
              <p>{guidance.visible || "No current screen observation."}</p>
              {guidance.uncertainty && (
                <p className="uncertainty">{guidance.uncertainty}</p>
              )}
            </>
          )}
          <div className="privacy-note">
            <ShieldCheck size={20} />
            <p>{t.privacy}</p>
            <small>
              Voice responses are AI-generated. Audio is sent only after you
              finish recording. Images are sent on demand.
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}
