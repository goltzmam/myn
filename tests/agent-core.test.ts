import { describe, it, expect } from "vitest";
import {
  assertTransition,
  canComplete,
  completeStep,
  verifyObservation,
  needsApproval,
} from "../lib/agent/core";
import { actionSchema, decisionSchema, planSchema } from "../lib/agent/schema";
import {
  sign,
  verify,
  validateDestination,
  publicAddress,
  safeText,
} from "../worker/protocol.mjs";
const secret = "test-signing-secret-of-more-than-thirty-two-characters";
describe("Agent core", () => {
  it("requires evidence for every completed step", () => {
    const step = {
      title: "Configure project",
      success: "The project is ready",
      status: "pending" as const,
    };
    expect(canComplete([step])).toBe(false);
    expect(() => completeStep([step], 0, "", "browser")).toThrow();
    expect(
      canComplete(
        completeStep([step], 0, "Project ready is visible", "browser"),
      ),
    ).toBe(true);
  });
  it("rejects illegal state transitions and terminal restarts", () => {
    expect(() => assertTransition("CREATED", "COMPLETED")).toThrow();
    expect(() => assertTransition("CANCELLED", "RUNNING")).toThrow();
    expect(() => assertTransition("RUNNING", "WAITING_FOR_USER")).not.toThrow();
  });
  it("matches actual visible evidence rather than model success claims", () => {
    const observation = {
      url: "https://example.com/project",
      text: "Setup incomplete",
      targets: [],
    };
    expect(
      verifyObservation(observation, { kind: "text", value: "Project ready" }),
    ).toBeNull();
    expect(
      verifyObservation(observation, {
        kind: "url",
        value: "https://example.com.evil.test/project",
      }),
    ).toBeNull();
    expect(
      verifyObservation(observation, {
        kind: "url",
        value: "https://example.com/project",
      }),
    ).toContain("matched");
  });
  it("requires approval for every mutating action and navigation", () => {
    expect(
      needsApproval({
        type: "click",
        target: { role: "button", name: "Publish" },
      }),
    ).toBe(true);
    expect(
      needsApproval({ type: "navigate", url: "https://example.com" }),
    ).toBe(true);
    expect(needsApproval({ type: "read" })).toBe(false);
  });
  it("rejects arbitrary execution, invented schema fields and oversized plans", () => {
    expect(
      actionSchema.safeParse({ type: "evaluate", script: "fetch(secret)" })
        .success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({
        type: "click",
        target: { role: "button", name: "Open" },
        force: true,
      }).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse({
        action: { type: "read" },
        explanation: "Done",
        assertion: { kind: "magic", value: "ok" },
      }).success,
    ).toBe(false);
    expect(
      planSchema.safeParse({ summary: "S", domains: ["*"], steps: [] }).success,
    ).toBe(false);
  });
});
describe("Worker boundary", () => {
  it("binds expiring commands to owner, task, session and exact domains", () => {
    const payload = {
      userId: "u",
      taskId: "t",
      sessionId: "s",
      domains: ["example.com"],
      nonce: "nonce",
      expires: Date.now() + 30000,
    };
    const token = sign(payload, secret);
    expect(verify(token, secret).taskId).toBe("t");
    expect(() => verify(token + "tampered", secret)).toThrow();
    expect(() => verify(token, secret, Date.now() + 60000)).toThrow();
  });
  it("blocks private destinations, IPs, cross-domain redirects and credential URLs", () => {
    for (const url of [
      "http://example.com",
      "https://127.0.0.1",
      "https://169.254.169.254",
      "https://example.com.evil.test",
      "https://user:pass@example.com",
      "https://example.com:8443",
    ])
      expect(() => validateDestination(url, ["example.com"])).toThrow();
    expect(
      validateDestination("https://example.com/path", ["example.com"]).hostname,
    ).toBe("example.com");
    for (const ip of [
      "127.0.0.1",
      "169.254.169.254",
      "192.168.1.1",
      "172.17.0.1",
      "10.0.0.1",
      "100.64.1.1",
      "::1",
      "::ffff:127.0.0.1",
    ])
      expect(publicAddress(ip)).toBe(false);
  });
  it("redacts obvious credentials from observation text", () => {
    expect(safeText("Bearer abcdefghijklmnopqrstuvwxyz")).toBe("[redacted]");
  });
});
