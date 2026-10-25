// Device-independent endpointing. No transcript, language or microphone data is persisted.
export class VoiceActivity {
  private firstVoice: number | null = null;
  private lastVoice = 0;
  private lastSample: number;
  private voicedMs = 0;
  private previousVoiced = false;
  constructor(
    private started: number,
    private threshold = 0.018,
  ) {
    this.lastSample = started;
  }
  observe(rms: number, now: number): "speech-end" | "silence-timeout" | null {
    const voiced = rms >= this.threshold;
    if (voiced) {
      this.firstVoice ??= now;
      if (this.previousVoiced)
        this.voicedMs += Math.min(300, now - this.lastSample);
      this.lastVoice = now;
    }
    this.lastSample = now;
    this.previousVoiced = voiced;
    if (this.firstVoice !== null && now - this.lastVoice >= 1200) {
      if (this.voicedMs >= 300) return "speech-end";
      this.firstVoice = null;
      this.voicedMs = 0;
    }
    if (now - this.started >= 45000 && this.voicedMs >= 300)
      return "speech-end";
    if (now - this.started >= 20000 && this.voicedMs < 300)
      return "silence-timeout";
    return null;
  }
}
export function rms(samples: Uint8Array) {
  let sum = 0;
  for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}
