"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic,
  MonitorUp,
  Square,
  Pause,
  Play,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
export function DeviceLab({
  mode = "guide",
  authenticated = false,
}: {
  mode?: string;
  authenticated?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    screen = useRef<MediaStream>(null),
    microphone = useRef<MediaStream>(null),
    recorder = useRef<MediaRecorder>(null),
    recordingUrl = useRef<string>(null),
    alive = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout>>(null);
  const [sharing, setSharing] = useState(false),
    [paused, setPaused] = useState(false),
    [recording, setRecording] = useState(false),
    [audioUrl, setAudioUrl] = useState<string>(),
    [error, setError] = useState(""),
    [micLevel, setMicLevel] = useState(0),
    [support, setSupport] = useState({
      screen: false,
      audio: false,
      secure: false,
    }),
    [screenTested, setScreenTested] = useState(false),
    [micTested, setMicTested] = useState(false);
  useEffect(() => {
    alive.current = true;
    setSupport({
      screen: !!navigator.mediaDevices?.getDisplayMedia,
      audio: !!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder,
      secure: window.isSecureContext,
    });
    return () => {
      alive.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      screen.current?.getTracks().forEach((t) => t.stop());
      microphone.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearTimeout(timer.current);
      if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);
    };
  }, []);
  function stopScreen() {
    screen.current?.getTracks().forEach((t) => t.stop());
    screen.current = null;
    if (video.current) video.current.srcObject = null;
    setSharing(false);
    setPaused(false);
  }
  async function share() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false,
      });
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      screen.current = stream;
      stream.getVideoTracks()[0].onended = stopScreen;
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play();
      }
      setSharing(true);
      setScreenTested(true);
    } catch {
      setError(
        "Não foi possível compartilhar a tela. Escolha uma aba ou janela no seletor do navegador.",
      );
    }
  }
  async function record() {
    setError("");
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      if (recordingUrl.current) {
        URL.revokeObjectURL(recordingUrl.current);
        recordingUrl.current = null;
        setAudioUrl(undefined);
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      microphone.current = stream;
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(
          stream,
          type ? { mimeType: type } : undefined,
        ),
        chunks: BlobPart[] = [];
      recorder.current = rec;
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream),
        analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      function measure() {
        if (!alive.current) return;
        analyser.getByteFrequencyData(samples);
        if (alive.current)
          setMicLevel(
            Math.min(100, samples.reduce((a, b) => a + b, 0) / samples.length),
          );
        raf = requestAnimationFrame(measure);
      }
      measure();
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        cancelAnimationFrame(raf);
        void context.close();
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearTimeout(timer.current);
        if (!alive.current) return;
        const url = URL.createObjectURL(
          new Blob(chunks, { type: rec.mimeType }),
        );
        recordingUrl.current = url;
        setAudioUrl(url);
        setRecording(false);
        setMicTested(true);
        setMicLevel(0);
      };
      rec.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 15000);
    } catch {
      microphone.current?.getTracks().forEach((t) => t.stop());
      setError(
        "Permita o microfone nas configurações do navegador e tente novamente.",
      );
    }
  }
  return (
    <>
      <div className="session-heading">
        <div>
          <span className="eyebrow">
            {authenticated ? "PRIMEIROS PASSOS" : "EXPERIMENTAR"} ·{" "}
            {mode.toUpperCase()}
          </span>
          <h1>Veja como é trabalhar com MYN.</h1>
          <p>Teste seus dispositivos antes da primeira conversa.</p>
        </div>
        <Link
          className="button primary"
          href={authenticated ? "/app/guide" : "/login"}
        >
          {authenticated ? "Abrir Guide" : "Entrar para usar IA"}
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="session-layout">
        <section>
          <div className="screen-preview">
            <video
              ref={video}
              muted
              playsInline
              className={sharing ? "" : "hidden"}
            />
            {!sharing && (
              <div className="preview-empty">
                <MonitorUp size={42} />
                <h2>Você escolhe o que compartilhar.</h2>
                <p>
                  Selecione uma janela, aba ou tela. A imagem fica apenas neste
                  navegador durante o teste.
                </p>
              </div>
            )}
            {sharing && (
              <span className="sharing-status">
                <span className="status-dot" />
                {paused
                  ? "PREVIEW PAUSADO"
                  : "COMPARTILHAMENTO LOCAL · NÃO ENVIADO À IA"}
              </span>
            )}
          </div>
          <div className="capture-toolbar">
            <Button
              disabled={!sharing && !support.screen}
              variant="secondary"
              onClick={sharing ? stopScreen : share}
            >
              <MonitorUp size={16} />
              {sharing ? "Parar compartilhamento" : "Compartilhar tela"}
            </Button>
            {sharing && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (paused) void video.current?.play();
                  else video.current?.pause();
                  setPaused(!paused);
                }}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
                {paused ? "Retomar preview" : "Pausar preview"}
              </Button>
            )}
          </div>
          {!support.screen && (
            <p className="notice">
              Use um navegador desktop compatível e uma conexão HTTPS para
              compartilhar a tela.
            </p>
          )}
          <section className="surface">
            <span className="eyebrow">SUA VOZ, COM CLAREZA</span>
            <h2>Vamos testar o microfone?</h2>
            <p>
              Grave até 15 segundos e ouça a reprodução. Este teste não envia
              nem transcreve seu áudio.
            </p>
            <div
              className="mic-meter"
              role="meter"
              aria-label="Nível do microfone"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(micLevel)}
            >
              <span style={{ width: micLevel + "%" }} />
            </div>
            <Button
              disabled={!support.audio}
              variant={recording ? "default" : "secondary"}
              onClick={record}
            >
              {recording ? <Square size={16} /> : <Mic size={16} />}{" "}
              {recording ? "Parar gravação" : "Testar microfone"}
            </Button>
            {recording && (
              <span role="status" className="record-label">
                Gravando · encerramento automático em 15 segundos
              </span>
            )}
            {audioUrl && (
              <div className="local-audio">
                <Volume2 size={18} />
                <audio
                  controls
                  src={audioUrl}
                  aria-label="Sua gravação local"
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (recordingUrl.current)
                      URL.revokeObjectURL(recordingUrl.current);
                    recordingUrl.current = null;
                    setAudioUrl(undefined);
                  }}
                >
                  Descartar áudio
                </Button>
              </div>
            )}
          </section>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
        </section>
        <aside className="task-panel">
          <span className="eyebrow">PRONTO PARA COMEÇAR</span>
          <h2>Seu checklist.</h2>
          {[
            [support.secure, "Conexão segura"],
            [screenTested, "Tela compartilhada"],
            [micTested, "Microfone testado"],
          ].map(([done, title]) => (
            <div
              className={"task-step " + (done ? "completed" : "pending")}
              key={String(title)}
            >
              <span>{done ? <CheckCircle2 size={15} /> : "·"}</span>
              <strong>{title}</strong>
            </div>
          ))}
          <div className="privacy-note">
            <ShieldCheck size={21} />
            <p>Você está no controle.</p>
            <small>
              Nenhuma captura ou gravação deste teste é enviada ao servidor ou
              salva no histórico. Este checklist verifica os dispositivos; ele
              não simula uma tarefa concluída pela IA.
            </small>
          </div>
          <Link
            className="button primary"
            href={authenticated ? "/app/guide" : "/signup"}
          >
            {authenticated ? "Começar sessão real" : "Criar minha conta"}
          </Link>
        </aside>
      </div>
    </>
  );
}
