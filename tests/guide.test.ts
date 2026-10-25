import { describe, it, expect } from "vitest";
import { requestSchema, verifiedSteps, guidanceSchema } from "../lib/guide";
import { changed } from "../lib/vision/capture";
describe("visual guidance safety", () => {
  it("does not complete steps without evidence", () => {
    const result = guidanceSchema.parse({
      reply: "Open settings",
      visible: "Settings",
      uncertainty: "",
      steps: [{ title: "Open settings", status: "completed", evidence: "" }],
      summary: "",
    });
    expect(verifiedSteps(result)[0].status).toBe("pending");
  });
  it("preserves evidence-backed progress", () => {
    const result = guidanceSchema.parse({
      reply: "Done",
      visible: "Success banner",
      uncertainty: "",
      steps: [
        {
          title: "Save",
          status: "completed",
          evidence: "Success banner visible",
        },
      ],
      summary: "Saved",
    });
    expect(verifiedSteps(result)[0].status).toBe("completed");
  });
  it("rejects remote images and invalid sessions", () => {
    expect(
      requestSchema.safeParse({
        sessionId: "other",
        message: "hi",
        image: "https://example.com",
      }).success,
    ).toBe(false);
  });
  it("rejects oversized input", () => {
    expect(
      requestSchema.safeParse({
        sessionId: crypto.randomUUID(),
        message: "x".repeat(4001),
      }).success,
    ).toBe(false);
  });
  it("accepts a valid compressed frame", () => {
    expect(
      requestSchema.safeParse({
        sessionId: crypto.randomUUID(),
        message: "Help me",
        image: "data:image/jpeg;base64,YQ==",
      }).success,
    ).toBe(true);
  });
  it("detects meaningful frame changes", () => {
    expect(
      changed(new Uint8ClampedArray(64), new Uint8ClampedArray(64).fill(100)),
    ).toBe(true);
    expect(changed(new Uint8ClampedArray(64), new Uint8ClampedArray(64))).toBe(
      false,
    );
  });
});
