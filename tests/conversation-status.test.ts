import { beforeEach, afterEach, it, expect, vi } from "vitest";
const s = vi.hoisted(() => ({
  identity: vi.fn(),
  create: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ identity: s.identity }));
vi.mock("@/lib/ai/provider", () => ({
  openai: () => ({ responses: { create: s.create } }),
}));
import { GET, POST } from "../app/api/conversation/status/route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MYN_AI_KEY", "server-only-fixture");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc1234longfixture");
  s.identity.mockResolvedValue({
    user: { id: "owner" },
    client: {
      from: () => ({
        select: () => ({ limit: async () => ({ error: null }) }),
      }),
      rpc: s.rpc,
    },
  });
  s.rpc.mockResolvedValue({ error: null });
  s.create.mockResolvedValue({ output_text: "OK" });
});
afterEach(() => vi.unstubAllEnvs());
it("identifies the actual preview environment and revision without returning a secret", async () => {
  const r = await GET();
  const d = await r.json();
  expect(d).toMatchObject({
    conversationConfigured: true,
    storageReady: true,
    deploymentEnvironment: "preview",
    revision: "abc1234",
    connectionTested: false,
  });
  expect(JSON.stringify(d)).not.toContain("server-only-fixture");
  expect(s.create).not.toHaveBeenCalled();
});
it("makes missing deployment configuration explicit rather than assuming the cloud secret was copied", async () => {
  vi.stubEnv("MYN_AI_KEY", "");
  expect(await (await GET()).json()).toMatchObject({
    conversationConfigured: false,
  });
});
it("the explicit test makes one bounded provider call and reserves usage", async () => {
  const r = await POST(
    new Request("https://myn.example/api/conversation/status", {
      method: "POST",
    }),
  );
  expect(r.status).toBe(200);
  expect(s.rpc).toHaveBeenCalledWith("reserve_usage", {
    p_session: null,
    p_kind: "analysis",
  });
  expect(s.create).toHaveBeenCalledWith(
    expect.objectContaining({ max_output_tokens: 16, store: false }),
    expect.anything(),
  );
});
it("reports provider rejection separately from an absent variable", async () => {
  s.create.mockRejectedValue({ code: "invalid_api_key", status: 401 });
  const r = await POST(
    new Request("https://myn.example/api/conversation/status", {
      method: "POST",
    }),
  );
  expect(r.status).toBe(503);
  expect(await r.json()).toMatchObject({ code: "AI_AUTH_FAILED" });
});
it("does not expose configuration details without a validated user", async () => {
  s.identity.mockRejectedValue(new Error("Unauthorized"));
  expect((await GET()).status).toBe(401);
});
