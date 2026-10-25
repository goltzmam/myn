import { beforeEach, it, expect, vi } from "vitest";
const s = vi.hoisted(() => ({
  identity: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  create: vi.fn(),
  configured: true,
}));
vi.mock("@/lib/auth/server", () => ({ identity: s.identity }));
vi.mock("@/lib/ai/provider", () => ({
  openai: () => {
    if (!s.configured)
      throw Object.assign(new Error("Conversation missing"), {
        code: "invalid_api_key",
      });
    return { responses: { create: s.create } };
  },
}));
import { POST } from "../app/api/chat/route";
const id = "33333333-3333-4333-8333-333333333333";
function req(body: unknown) {
  return new Request("https://myn.example/api/chat", {
    method: "POST",
    headers: {
      origin: "https://myn.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  s.configured = true;
  s.identity.mockResolvedValue({
    user: { id: "owner" },
    client: { rpc: s.rpc, from: s.from },
  });
  s.rpc.mockResolvedValue({ error: null });
  s.from.mockImplementation((table: string) => {
    const data =
      table === "sessions"
        ? {
            id,
            status: "active",
            mode: "guide",
            resumed_at: new Date().toISOString(),
            objective: "Learn",
            agent_id: null,
          }
        : table === "profiles"
          ? { full_name: "Ana" }
          : null;
    const q: any = {
      select: () => q,
      eq: () => q,
      order: () => q,
      maybeSingle: async () => ({ data, error: null }),
      limit: async () => ({ data: [], error: null }),
    };
    return q;
  });
  s.create.mockResolvedValue({
    controller: { abort: vi.fn() },
    async *[Symbol.asyncIterator]() {
      yield {
        type: "response.output_text.delta",
        delta: "Olá, Ana! Vamos olhar juntos?",
      };
      yield {
        type: "response.completed",
        response: { usage: { total_tokens: 20 } },
      };
    },
  });
});
it("streams a current shared image and saves a multilingual turn", async () => {
  const r = await POST(
    req({
      sessionId: id,
      message: "Explique esta tela",
      image: "data:image/jpeg;base64,YQ==",
      language: "fr",
    }),
  );
  expect(r.status).toBe(200);
  const events = (await r.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(events[0]).toMatchObject({ accepted: true, questionSaved: true });
  expect(events.some((e) => e.delta)).toBe(true);
  expect(events.at(-1)).toMatchObject({ done: true, saved: true });
  const params = s.create.mock.calls[0][0];
  expect(params.input.at(-1).content).toContainEqual({
    type: "input_image",
    image_url: "data:image/jpeg;base64,YQ==",
    detail: "high",
  });
  expect(s.rpc).toHaveBeenCalledWith(
    "save_exchange",
    expect.objectContaining({ p_reply: "Olá, Ana! Vamos olhar juntos?" }),
  );
});
it("voice activation generates and stores a real introduction without a fabricated user utterance", async () => {
  const r = await POST(
    req({
      sessionId: id,
      kind: "welcome",
      language: "auto",
      locale: "pt-BR",
      screenAvailable: true,
    }),
  );
  expect(r.status).toBe(200);
  await r.text();
  expect(s.rpc).not.toHaveBeenCalledWith("save_question", expect.anything());
  expect(s.rpc).toHaveBeenCalledWith(
    "save_welcome",
    expect.objectContaining({ p_reply: "Olá, Ana! Vamos olhar juntos?" }),
  );
  expect(s.create.mock.calls[0][0].input[1].content).toContain("Ana");
  expect(s.create.mock.calls[0][0].input[1].content).toContain("pt-BR");
  expect(s.create.mock.calls[0][0].input.at(-1).content[0].text).toContain(
    "eye button",
  );
});
it("a failed provider still acknowledges that the question was already stored", async () => {
  s.configured = false;
  const r = await POST(req({ sessionId: id, message: "Help" }));
  expect(r.status).toBe(503);
  expect(await r.json()).toMatchObject({
    code: "AI_AUTH_FAILED",
    questionSaved: true,
  });
  expect(s.create).not.toHaveBeenCalled();
});
it("an incomplete provider stream is reported instead of a permanent thinking state", async () => {
  s.create.mockResolvedValue({
    controller: { abort: vi.fn() },
    async *[Symbol.asyncIterator]() {
      yield { type: "response.output_text.delta", delta: "Partial" };
      yield { type: "response.incomplete" };
    },
  });
  const r = await POST(req({ sessionId: id, message: "Help" }));
  const events = (await r.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(events.at(-1)).toMatchObject({
    code: "REQUEST_FAILED",
    questionSaved: true,
  });
  expect(events.some((e) => e.done)).toBe(false);
  expect(s.rpc).not.toHaveBeenCalledWith("save_exchange", expect.anything());
});
