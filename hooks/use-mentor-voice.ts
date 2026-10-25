"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceActivity, rms } from "@/lib/audio/activity";
export function useMentorVoice({
  onUtterance,
  onError,
}: {
  onUtterance: (file: File) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [listening, setListening] = useState(false),
    [active, setActive] = useState(false),
    [level, setLevel] = useState(0);
  const generation = useRef(0);
  const running = useRef(false),
    media = useRef<MediaStream>(null),
    context = useRef<AudioContext>(null),
    recorder = useRef<MediaRecorder>(null),
    sampling = useRef<ReturnType<typeof setInterval>>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(null),
    callbacks = useRef({ onUtterance, onError });
  callbacks.current = { onUtterance, onError };
  const stop = useCallback(() => {
    running.current = false;
    generation.current++;
    setActive(false);
    setListening(false);
    setLevel(0);
    if (sampling.current) clearInterval(sampling.current);
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    void context.current?.close().catch(() => {});
    context.current = null;
  }, []);
  useEffect(() => () => stop(), [stop]);
  async function start(continuous = true, beforeListen?: () => Promise<void>) {
    if (running.current) return;
    let token = 0;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw Object.assign(
          new Error(
            "Microphone capture requires a compatible browser and HTTPS.",
          ),
          { code: "MICROPHONE_UNAVAILABLE" },
        );
      token = ++generation.current;
      const current = () => running.current && generation.current === token;
      running.current = true;
      setActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (!current()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      media.current = stream;
      const ctx = new AudioContext();
      context.current = ctx;
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      function recordTurn() {
        if (!current()) return;
        const type = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/ogg",
        ].find((t) => MediaRecorder.isTypeSupported(t));
        const rec = new MediaRecorder(stream, {
            ...(type ? { mimeType: type } : {}),
            audioBitsPerSecond: 64000,
          }),
          chunks: BlobPart[] = [];
        recorder.current = rec;
        const activity = new VoiceActivity(performance.now());
        let discard = false;
        rec.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        rec.onerror = () => {
          if (!current()) return;
          callbacks.current.onError(new Error("Microphone recording failed."));
          stop();
        };
        rec.onstop = async () => {
          if (sampling.current) clearInterval(sampling.current);
          setListening(false);
          setLevel(0);
          if (!current()) return;
          if (discard) {
            timer.current = setTimeout(recordTurn, 250);
            return;
          }
          try {
            const blob = new Blob(chunks, { type: rec.mimeType });
            if (blob.size)
              await callbacks.current.onUtterance(
                new File(
                  [blob],
                  "question." +
                    (rec.mimeType.includes("mp4")
                      ? "mp4"
                      : rec.mimeType.includes("ogg")
                        ? "ogg"
                        : "webm"),
                  { type: rec.mimeType },
                ),
              );
            if (!current()) return;
            if (continuous) timer.current = setTimeout(recordTurn, 250);
            else stop();
          } catch (e) {
            if (!current()) return;
            callbacks.current.onError(e);
            stop();
          }
        };
        rec.start(250);
        setListening(true);
        function sample() {
          if (!current() || rec.state !== "recording") return;
          analyser.getByteTimeDomainData(samples);
          const volume = rms(samples);
          setLevel(Math.min(100, Math.round(volume * 500)));
          const event = activity.observe(volume, performance.now());
          if (event) {
            discard = event === "silence-timeout";
            rec.stop();
            return;
          }
        }
        sample();
        sampling.current = setInterval(sample, 100);
      }
      if (beforeListen) await beforeListen();
      if (current()) recordTurn();
    } catch (e) {
      if (token && generation.current !== token) return;
      stop();
      const mediaError = e as Error;
      callbacks.current.onError(
        [
          "NotAllowedError",
          "NotFoundError",
          "NotReadableError",
          "SecurityError",
        ].includes(mediaError.name)
          ? Object.assign(
              new Error(
                "Allow access to a working microphone in your browser.",
              ),
              { code: "MICROPHONE_UNAVAILABLE" },
            )
          : e,
      );
    }
  }
  function finish() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  return { start, stop, finish, listening, active, level };
}
