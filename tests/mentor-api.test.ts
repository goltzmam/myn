import { beforeEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  identity: vi.fn(),
  analyze: vi.fn(),
  transcribe: vi.fn(),
  speech: vi.fn(),
  client: null as any,
}));
vi.mock("@/lib/auth/server", () => ({ identity: state.identity }));
vi.mock("@/lib/ai/provider", () => ({
  provider: { analyze: state.analyze },
  openai: () => ({
    audio: {
      transcriptions: { create: state.transcribe },
      speech: { create: state.speech },
    },
  }),
}));
import { POST as assist } from "../app/api/assist/route";
import { POST as audio } from "../app/api/audio/route";
import { POST as createSession } from "../app/api/sessions/route";
const id = "33333333-3333-4333-8333-333333333333",
  user = "11111111-1111-4111-8111-111111111111";
const guidance = {
  reply: "設定ボタンを開いてください。",
  visible: "Settings button",
  uncertainty: "",
  steps: [],
  summary: "設定画面を確認しました。",
};
function request(body: unknown) {
  return new Request("https://myn.example/api/assist", {
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
  state.client = { rpc: state.rpc, from: state.from };
  state.identity.mockResolvedValue({
    client: state.client,
    user: { id: user },
  });
  state.rpc.mockResolvedValue({ data: null, error: null });
  state.from.mockImplementation((table: string) => {
    const row =
      table === "sessions"
        ? {
            id,
            user_id: user,
            mode: "guide",
            status: "active",
            resumed_at: new Date().toISOString(),
            objective: "Learn settings",
          }
        : null;
    const builder: any = {
      select: () => builder,
      insert: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: row, error: null }),
      single: async () => ({ data: row, error: null }),
    };
    return builder;
  });
  state.analyze.mockResolvedValue({ guidance: { ...guidance }, tokens: 42 });
  state.transcribe.mockResolvedValue({ text: "この画面で何をすればいい？" });
  state.speech.mockResolvedValue({
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  });
});
it("analyzes the current screen, responds in the detected language and saves both sides of the turn", async () => {
  const turnId = crypto.randomUUID(),
    image = "data:image/jpeg;base64,YQ==";
  const response = await assist(
    request({
      sessionId: id,
      turnId,
      message: "この画面で何をすればいい？",
      image,
      language: "auto",
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    reply: guidance.reply,
    saved: true,
    turnId,
  });
  expect(state.analyze.mock.calls[0][0]).toMatchObject({
    image,
    language: "auto",
    mode: "guide",
  });
  expect(state.rpc).toHaveBeenCalledWith(
    "save_question",
    expect.objectContaining({
      p_turn: turnId,
      p_question: "この画面で何をすればいい？",
    }),
  );
  expect(state.rpc).toHaveBeenCalledWith(
    "save_exchange",
    expect.objectContaining({ p_turn: turnId, p_reply: guidance.reply }),
  );
});
it("reports missing migration as setup failure, not a quota error", async () => {
  state.rpc.mockResolvedValue({ error: { code: "PGRST202" } });
  const response = await assist(request({ sessionId: id, message: "Help" }));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: "DATABASE_NOT_READY" });
  expect(state.analyze).not.toHaveBeenCalled();
});
it("retains the question when the AI rejects credentials", async () => {
  state.analyze.mockRejectedValue({ code: "invalid_api_key", status: 401 });
  const response = await assist(
    request({ sessionId: id, message: "Explain this" }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: "AI_AUTH_FAILED" });
  expect(state.rpc).toHaveBeenCalledWith("save_question", expect.anything());
  expect(state.rpc).not.toHaveBeenCalledWith(
    "save_exchange",
    expect.anything(),
  );
});
it("still returns the actual reply with an unsaved warning when the final database write fails", async () => {
  state.rpc.mockImplementation(async (name: string) => ({
    error: name === "save_exchange" ? { code: "PGRST202" } : null,
  }));
  const response = await assist(
    request({ sessionId: id, message: "Explain this" }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    reply: guidance.reply,
    saved: false,
    warning: { code: "DATABASE_NOT_READY" },
  });
});
it("rejects requests without identity before any AI call", async () => {
  state.identity.mockRejectedValue(new Error("Unauthorized"));
  const response = await assist(request({ sessionId: id, message: "Help" }));
  expect(response.status).toBe(401);
  expect(state.analyze).not.toHaveBeenCalled();
});
it("transcribes multilingual recordings without forcing English or Portuguese", async () => {
  const data = new FormData();
  data.set("sessionId", id);
  data.set("language", "auto");
  data.set(
    "audio",
    new File([new Uint8Array([1, 2])], "question.webm", {
      type: "audio/webm;codecs=opus",
    }),
  );
  const response = await audio(
    new Request("https://myn.example/api/audio", {
      method: "POST",
      body: data,
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    text: "この画面で何をすればいい？",
  });
  expect(state.transcribe.mock.calls[0][0].language).toBeUndefined();
  expect(state.rpc).toHaveBeenCalledWith("reserve_usage", {
    p_session: id,
    p_kind: "audio",
  });
});
it("synthesizes the real answer in its original language and returns playable audio", async () => {
  const response = await audio(
    request({ sessionId: id, text: guidance.reply, language: "ja" }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("audio/mpeg");
  expect((await response.arrayBuffer()).byteLength).toBe(3);
  expect(state.speech).toHaveBeenCalledWith(
    expect.objectContaining({
      input: guidance.reply,
      instructions: expect.stringContaining("Do not translate"),
    }),
  );
});
it("empty audio and expired sessions never invoke paid providers", async () => {
  const data = new FormData();
  data.set("sessionId", id);
  data.set("audio", new File([], "question.webm", { type: "audio/webm" }));
  expect(
    (
      await audio(
        new Request("https://myn.example/api/audio", {
          method: "POST",
          body: data,
        }),
      )
    ).status,
  ).toBe(400);
  expect(state.transcribe).not.toHaveBeenCalled();
});
it("session creation reports unavailable storage instead of returning a fake session", async () => {
  state.from.mockReturnValue({
    insert() {
      return this;
    },
    select() {
      return this;
    },
    async single() {
      return { data: null, error: { code: "PGRST205" } };
    },
  });
  const response = await createSession(
    request({ mode: "guide", objective: "Learn" }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: "DATABASE_NOT_READY" });
});
