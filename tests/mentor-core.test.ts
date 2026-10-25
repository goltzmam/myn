import { describe, it, expect } from "vitest";
import { VoiceActivity, rms } from "../lib/audio/activity";
import { conversationLanguageSchema, requestSchema } from "../lib/guide";
import { databaseError, publicError, errorMessage } from "../lib/errors";
describe("multilingual mentor", () => {
  it.each([
    "auto",
    "pt-BR",
    "en",
    "es",
    "fr",
    "ar",
    "hi",
    "ja",
    "zh-Hant",
    "sw",
    "uk",
    "bn",
    "he",
    "ko",
  ])("accepts conversation language %s independently of UI", (language) => {
    expect(conversationLanguageSchema.parse(language)).toBe(language);
    expect(
      requestSchema.parse({
        sessionId: crypto.randomUUID(),
        message: "مرحبا، هل يمكنك مساعدتي؟",
        language,
      }).language,
    ).toBe(language);
  });
  it("defaults to auto detection and rejects malformed codes", () => {
    expect(
      requestSchema.parse({ sessionId: crypto.randomUUID(), message: "你好" })
        .language,
    ).toBe("auto");
    expect(
      conversationLanguageSchema.safeParse("invalid code with spaces").success,
    ).toBe(false);
  });
  it("distinguishes a missing database function from quota exhaustion", () => {
    try {
      databaseError({ code: "PGRST202", message: "Function missing" });
    } catch (e) {
      expect(publicError(e).code).toBe("DATABASE_NOT_READY");
      expect(publicError(e).status).toBe(503);
    }
    try {
      databaseError({ code: "P0001", message: "Monthly limit" });
    } catch (e) {
      expect(publicError(e).code).toBe("QUOTA_EXCEEDED");
    }
  });
  it("reports provider credentials and credits without revealing secret values", () => {
    expect(
      publicError({
        code: "invalid_api_key",
        message: "private credential text",
      }).message,
    ).not.toContain("private");
    expect(publicError({ code: "insufficient_quota" }).code).toBe(
      "AI_CREDITS_REQUIRED",
    );
    expect(errorMessage("DATABASE_NOT_READY", "fallback", "pt-BR")).toContain(
      "armazenamento",
    );
  });
});
describe("voice endpointing", () => {
  it("waits for a pause after speech instead of stopping between words", () => {
    const a = new VoiceActivity(0);
    expect(a.observe(0.1, 100)).toBeNull();
    expect(a.observe(0.1, 600)).toBeNull();
    expect(a.observe(0, 1000)).toBeNull();
    expect(a.observe(0.1, 1100)).toBeNull();
    expect(a.observe(0, 2250)).toBeNull();
    expect(a.observe(0, 2300)).toBe("speech-end");
  });
  it("does not upload silence and bounds long recordings", () => {
    expect(new VoiceActivity(0).observe(0, 20000)).toBe("silence-timeout");
    const a = new VoiceActivity(0);
    a.observe(0.2, 100);
    expect(a.observe(0.2, 45001)).toBe("speech-end");
  });
  it("measures silence and speech without transcribing locally", () => {
    expect(rms(new Uint8Array(20).fill(128))).toBe(0);
    expect(rms(new Uint8Array(20).fill(160))).toBeGreaterThan(0.1);
  });
});
it("ignores an isolated keyboard spike instead of sending it as a paid speech turn", () => {
  const a = new VoiceActivity(0);
  a.observe(0.1, 10);
  expect(a.observe(0, 1300)).toBeNull();
  expect(a.observe(0, 20001)).toBe("silence-timeout");
});

import { sameOrigin } from "../lib/security";
it("validates browser origin against the actual Host when Next uses an internal bind address", () => {
  expect(() =>
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/sessions", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
  ).not.toThrow();
  expect(() =>
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/sessions", {
        headers: {
          host: "127.0.0.1:3000",
          origin: "https://untrusted.example",
        },
      }),
    ),
  ).toThrow("Forbidden");
});
