// @vitest-environment jsdom
import React from "react";
import {
  render,
  fireEvent,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  finish: vi.fn(),
  frame: vi.fn(),
  config: null as any,
  active: false,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) =>
    React.createElement("a", props, children),
}));
vi.mock("@/hooks/use-mentor-voice", () => ({
  useMentorVoice: (config: unknown) => {
    mocks.config = config;
    return {
      start: mocks.start,
      stop: mocks.stop,
      finish: mocks.finish,
      active: mocks.active,
      listening: false,
      level: 0,
    };
  },
}));
vi.mock("@/lib/vision/capture", () => ({ frame: mocks.frame }));
import { Session } from "../components/session";
import { usePreferences } from "../stores/preferences";
const id = "33333333-3333-4333-8333-333333333333";
const reply = "यहाँ सेटिंग खोलें और अपना विकल्प चुनें।";
let calls: { url: string; body: any }[];
function response(guidance?: Record<string, unknown>) {
  return Response.json({
    reply,
    visible: "Settings",
    uncertainty: "",
    steps: [],
    summary: "Discussed settings",
    saved: true,
    ...guidance,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  calls = [];
  mocks.active = false;
  history.replaceState({}, "", "/");
  usePreferences.setState({ language: "pt-BR", speechLanguage: "auto" });
  mocks.frame.mockResolvedValue("data:image/jpeg;base64,YQ==");
  mocks.start.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getDisplayMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
        getVideoTracks: () => [{}],
      }),
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    queueMicrotask(() => this.dispatchEvent(new Event("ended")));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body =
        init.body instanceof FormData
          ? init.body
          : JSON.parse(init.body as string);
      calls.push({ url, body });
      if (url === "/api/sessions") return Response.json({ id });
      if (url === "/api/chat")
        return new Response(
          JSON.stringify({ accepted: true, questionSaved: true }) +
            "\n" +
            JSON.stringify({ delta: reply }) +
            "\n" +
            JSON.stringify({ done: true, saved: true }) +
            "\n",
          { headers: { "Content-Type": "application/x-ndjson" } },
        );
      if (url === "/api/assist") return response();
      if (url === "/api/audio" && body instanceof FormData)
        return Response.json({ text: "इस स्क्रीन को समझाइए।" });
      if (url === "/api/audio")
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "audio/mpeg" },
        });
      throw new Error("Unexpected test endpoint");
    }),
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test-audio"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function ask(text: string) {
  fireEvent.change(
    screen.getByRole("textbox", { name: "O que você quer realizar?" }),
    { target: { value: text } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() =>
    expect(screen.getAllByText(reply).length).toBeGreaterThan(0),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Enviar" }).hasAttribute("disabled"),
    ).toBe(true),
  );
}
it("captures a fresh shared frame per question, shows the real answer and requests speech for the same session", async () => {
  render(React.createElement(Session, { mode: "guide" }));
  fireEvent.click(screen.getByRole("button", { name: "Compartilhar tela" }));
  await waitFor(() => expect(screen.getByText("Vendo juntos")).toBeTruthy());
  await ask("इस स्क्रीन को समझाइए।");
  await waitFor(() =>
    expect(calls.filter((c) => c.url === "/api/audio")).toHaveLength(1),
  );
  expect(calls.find((c) => c.url === "/api/assist")?.body).toMatchObject({
    sessionId: id,
    language: "auto",
    image: "data:image/jpeg;base64,YQ==",
  });
  expect(calls.find((c) => c.url === "/api/audio")?.body).toMatchObject({
    sessionId: id,
    text: reply,
  });
  await waitFor(() =>
    expect(
      screen.getByText("Conversa salva no seu histórico privado."),
    ).toBeTruthy(),
  );
  mocks.frame.mockResolvedValue("data:image/jpeg;base64,Yg==");
  await ask("E agora?");
  await waitFor(() =>
    expect(calls.filter((c) => c.url === "/api/assist")).toHaveLength(2),
  );
  expect(calls.filter((c) => c.url === "/api/assist")[1].body.image).toBe(
    "data:image/jpeg;base64,Yg==",
  );
});
it("transcribes a voice turn then sends the original-language text to vision and speech", async () => {
  mocks.start.mockImplementation(async () =>
    mocks.config.onUtterance(
      new File(["voice"], "question.webm", { type: "audio/webm" }),
    ),
  );
  render(React.createElement(Session, { mode: "guide" }));
  fireEvent.click(screen.getByRole("button", { name: "Gravar pergunta" }));
  await waitFor(() =>
    expect(calls.filter((c) => c.url === "/api/assist")).toHaveLength(1),
  );
  expect(calls.find((c) => c.url === "/api/assist")?.body.message).toBe(
    "इस स्क्रीन को समझाइए।",
  );
  await waitFor(() => expect(screen.getByText(reply)).toBeTruthy());
  const form = calls.find((c) => c.body instanceof FormData)!.body as FormData;
  expect(form.get("sessionId")).toBe(id);
  expect(form.get("language")).toBe("auto");
});
it("keeps text available when speech generation fails", async () => {
  const original = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/audio")
        return Response.json(
          { error: "No credits", code: "AI_CREDITS_REQUIRED" },
          { status: 503 },
        );
      return original(url, init);
    }),
  );
  render(React.createElement(Session, { mode: "guide" }));
  await ask("Ajude-me");
  await waitFor(() => expect(screen.getByText(/sem créditos/)).toBeTruthy());
  expect(screen.getByText(reply)).toBeTruthy();
  expect(
    screen.getByText("Conversa salva no seu histórico privado."),
  ).toBeTruthy();
});
it("shows an actionable setup link instead of silently failing when the database is missing", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { error: "Storage missing", code: "DATABASE_NOT_READY" },
        { status: 503 },
      ),
    ),
  );
  render(React.createElement(Session, { mode: "guide" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "O que você quer realizar?" }),
    { target: { value: "Olá" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("link", { name: /Ativar mentor e histórico/ })
        .getAttribute("href"),
    ).toBe("/app/setup"),
  );
  expect(
    screen.queryByText("Conversa salva no seu histórico privado."),
  ).toBeNull();
});
it("offers a visible player when the browser blocks automatic audio", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
    new DOMException("Gesture required", "NotAllowedError"),
  );
  render(React.createElement(Session, { mode: "guide" }));
  await ask("Explique");
  await waitFor(() =>
    expect(screen.getByText(/bloqueou o início automático/)).toBeTruthy(),
  );
  expect(
    screen.getByLabelText("Resposta em áudio do mentor").getAttribute("class"),
  ).toBe("conversation-audio");
  expect(screen.getByText(reply)).toBeTruthy();
});

it("untrusted URL text only prefills and cannot automatically spend quota", async () => {
  render(
    React.createElement(Session, {
      mode: "guide",
      compact: true,
      initialMessage: "Untrusted incoming link",
    }),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("textbox", {
          name: "O que você quer realizar?",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Untrusted incoming link"),
  );
  expect(calls).toHaveLength(0);
});
it("an intentional Home handoff is consumed once, even in StrictMode", async () => {
  const key = crypto.randomUUID();
  sessionStorage.setItem("myn-draft:" + key, "Minha pergunta");
  render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(Session, {
        mode: "guide",
        compact: true,
        draftKey: key,
      }),
    ),
  );
  await waitFor(() =>
    expect(calls.filter((c) => c.url === "/api/chat")).toHaveLength(1),
  );
  expect(sessionStorage.getItem("myn-draft:" + key)).toBeNull();
  await waitFor(() => expect(screen.getByText(reply)).toBeTruthy());
});
it("streams a current screen through the production Elo path and keeps language switching enabled", async () => {
  render(React.createElement(Session, { mode: "wake", compact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Compartilhar tela" }));
  await waitFor(() => expect(screen.getByText("Vendo juntos")).toBeTruthy());
  const menu = screen.getByLabelText("Alterar idioma");
  fireEvent.click(menu);
  fireEvent.change(screen.getByLabelText("Idioma da conversa"), {
    target: { value: "fr" },
  });
  expect(
    (screen.getByLabelText("Idioma da conversa") as HTMLSelectElement).disabled,
  ).toBe(false);
  await ask("Explique cette page");
  const request = calls.find((c) => c.url === "/api/chat");
  expect(request?.body).toMatchObject({
    kind: "message",
    language: "fr",
    image: "data:image/jpeg;base64,YQ==",
  });
  expect(screen.queryByText("Elo", { exact: true })).toBeNull();
});
it("voice starts with a stored model introduction before the first recorded question", async () => {
  const original = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (
        url === "/api/chat" &&
        JSON.parse(init.body as string).kind === "welcome"
      ) {
        const body = JSON.parse(init.body as string);
        calls.push({ url, body });
        return new Response(
          JSON.stringify({ delta: "Olá, sou a MYN. Vamos olhar juntos?" }) +
            "\n" +
            JSON.stringify({ done: true, saved: true }) +
            "\n",
        );
      }
      return original(url, init);
    }),
  );
  mocks.start.mockImplementation(
    async (_continuous: boolean, beforeListen?: () => Promise<void>) => {
      await beforeListen?.();
      expect(calls.find((c) => c.url === "/api/chat")?.body.kind).toBe(
        "welcome",
      );
      expect(
        calls.some(
          (c) => c.url === "/api/audio" && !(c.body instanceof FormData),
        ),
      ).toBe(true);
      expect(
        document.querySelectorAll(".conversation-message.user"),
      ).toHaveLength(0);
      await mocks.config.onUtterance(
        new File(["voice"], "question.webm", { type: "audio/webm" }),
      );
    },
  );
  render(React.createElement(Session, { mode: "wake", compact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Conversar por voz" }));
  await waitFor(() =>
    expect(calls.filter((c) => c.url === "/api/chat")).toHaveLength(2),
  );
  expect(calls.filter((c) => c.url === "/api/chat")[1].body.message).toBe(
    "इस स्क्रीन को समझाइए।",
  );
  await waitFor(() => expect(screen.getByText(reply)).toBeTruthy());
});
it("a language change during an active voice session applies to the very next question", async () => {
  let release!: () => void;
  const nextQuestion = new Promise<void>((r) => (release = r));
  mocks.start.mockImplementation(
    async (_continuous: boolean, beforeListen?: () => Promise<void>) => {
      mocks.active = true;
      await beforeListen?.();
      await nextQuestion;
      await mocks.config.onUtterance(
        new File(["voice"], "question.webm", { type: "audio/webm" }),
      );
    },
  );
  render(React.createElement(Session, { mode: "wake", compact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Conversar por voz" }));
  await waitFor(() => expect(screen.getByText(reply)).toBeTruthy());
  fireEvent.click(screen.getByLabelText("Alterar idioma"));
  const select = screen.getByLabelText(
    "Idioma da conversa",
  ) as HTMLSelectElement;
  expect(select.disabled).toBe(false);
  fireEvent.change(select, { target: { value: "fr" } });
  release();
  await waitFor(() =>
    expect(calls.filter((c) => c.url === "/api/chat")).toHaveLength(2),
  );
  expect(calls.filter((c) => c.url === "/api/chat")[1].body.language).toBe(
    "fr",
  );
  expect(calls.filter((c) => c.url === "/api/chat")[1].body.message).toBe(
    "इस स्क्रीन को समझाइए।",
  );
});

it("opens immersive mode without recording, reveals text on request, and preserves the draft when exiting", () => {
  render(React.createElement(Session, { mode: "wake", compact: true }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "O que você quer realizar?" }),
    { target: { value: "Quero explorar uma ideia" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Abrir modo imersivo" }));
  expect(
    screen.getByRole("dialog", { name: "Conversa imersiva" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("textbox", { name: "O que você quer realizar?" }),
  ).toBeNull();
  expect(mocks.start).not.toHaveBeenCalled();
  expect(calls).toHaveLength(0);
  fireEvent.click(
    screen.getByRole("button", { name: "Mostrar conversa e escrever" }),
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "O que você quer realizar?",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Quero explorar uma ideia");
  fireEvent.click(screen.getByRole("button", { name: "Ouvir respostas" }));
  expect(
    screen
      .getByRole("button", { name: "Silenciar respostas" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    (
      screen.getByRole("textbox", {
        name: "O que você quer realizar?",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Quero explorar uma ideia");
  expect(document.body.style.overflow).toBe("");
});
