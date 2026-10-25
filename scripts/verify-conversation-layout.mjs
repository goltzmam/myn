// Authenticated browser regression: real auth/session infrastructure, explicitly isolated provider/media fixtures.
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "@playwright/test";
const base = process.env.MYN_TEST_ORIGIN || "http://127.0.0.1:3020",
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !anon || !token)
  throw new Error("Secure test configuration required");
const ref = new URL(url).hostname.split(".")[0],
  keysResponse = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/api-keys`,
    { headers: { Authorization: "Bearer " + token } },
  );
if (!keysResponse.ok) throw new Error("Project access failed");
const keys = await keysResponse.json(),
  service = keys.find((k) => k.name === "service_role")?.api_key;
if (!service) throw new Error("Administrative test access unavailable");
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let userId, browser;
function assert(value, label) {
  if (!value) throw new Error("Failed: " + label);
  console.log("PASS " + label);
}
try {
  const email = `layout-${randomUUID()}@checks.myn.invalid`,
    password = randomBytes(24).toString("base64url");
  const made = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Teste de interface" },
  });
  if (made.error) throw new Error("Test account failed");
  userId = made.data.user.id;
  const jar = new Map(),
    client = createServerClient(url, anon, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll(items) {
          items.forEach(({ name, value }) => jar.set(name, value));
        },
      },
    });
  if ((await client.auth.signInWithPassword({ email, password })).error)
    throw new Error("Test login failed");
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies(
    [...jar].map(([name, value]) => ({ name, value, url: base })),
  );
  await context.addInitScript(() => {
    localStorage.setItem(
      "myn-preferences",
      JSON.stringify({
        state: { language: "pt-BR", speechLanguage: "auto" },
        version: 0,
      }),
    );
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#25342e";
        ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = "#d8eee0";
        ctx.font = "36px sans-serif";
        ctx.fillText("Janela compartilhada · Teste de layout", 60, 100);
        window.__layoutCanvas = canvas;
        return canvas.captureStream(2);
      },
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const ctx = new AudioContext(),
          osc = ctx.createOscillator(),
          gain = ctx.createGain(),
          dest = ctx.createMediaStreamDestination();
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime + 3);
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        window.__testAudioContext = ctx;
        return dest.stream;
      },
    });
  });
  await context.route(url + "/**", async (route) => {
    const request = route.request(),
      headers = { ...request.headers() };
    delete headers.host;
    delete headers["content-length"];
    const r = await fetch(request.url(), {
      method: request.method(),
      headers,
      ...(["GET", "HEAD"].includes(request.method())
        ? {}
        : { body: request.postDataBuffer() }),
    });
    const h = Object.fromEntries(r.headers);
    for (const key of [
      "content-encoding",
      "content-length",
      "transfer-encoding",
    ])
      delete h[key];
    await route.fulfill({
      status: r.status,
      headers: h,
      body: Buffer.from(await r.arrayBuffer()),
    });
  });
  const turns = [];
  let turnNumber = 0;
  await context.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    turns.push(body);
    const text =
      body.kind === "welcome"
        ? "Olá! Sou a MYN. Esta é uma apresentação de teste. Quando quiser, compartilhe a tela pelo olho."
        : `Resposta de teste ${++turnNumber}. ` +
          "Um parágrafo para verificar o espaço das mensagens e a continuidade da conversa.\n\n".repeat(
            45,
          );
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
      body:
        JSON.stringify({ accepted: true, questionSaved: true }) +
        "\n" +
        JSON.stringify({ delta: text }) +
        "\n" +
        JSON.stringify({ done: true, saved: true }) +
        "\n",
    });
  });
  function wav() {
    const data = new Uint8Array(44 + 2400),
      v = new DataView(data.buffer);
    const word = (i, s) =>
      [...s].forEach((c, j) => v.setUint8(i + j, c.charCodeAt(0)));
    word(0, "RIFF");
    v.setUint32(4, data.length - 8, true);
    word(8, "WAVE");
    word(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true);
    v.setUint32(28, 16000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    word(36, "data");
    v.setUint32(40, 2400, true);
    return Buffer.from(data);
  }
  await context.route("**/api/audio", async (route) => {
    if (
      route.request().headers()["content-type"]?.includes("multipart/form-data")
    )
      await route.fulfill({ json: { text: "Uma pergunta falada de teste." } });
    else await route.fulfill({ contentType: "audio/wav", body: wav() });
  });
  const page = await context.newPage();
  for (const path of ["/app", "/app/agents", "/app/settings"]) {
    await page.goto(base + path);
    assert(
      (await page
        .getByRole("button", { name: "Nova conversa", exact: true })
        .count()) === 0,
      "new conversation absent on " + path,
    );
  }
  await page.goto(base + "/app/elo");
  await page
    .getByRole("button", { name: "Nova conversa", exact: true })
    .waitFor();
  assert(
    (await page.getByText("Elo", { exact: true }).count()) === 1,
    "Elo is named only once, in navigation",
  );
  await page
    .getByRole("button", { name: "Compartilhar tela", exact: true })
    .click();
  await page.getByText("Vendo juntos", { exact: true }).waitFor();
  const input = page.getByRole("textbox", {
    name: "O que você quer realizar?",
  });
  await input.fill("Explique esta tela de teste");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await page.getByText("Resposta de teste 1.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Enviar", exact: true }).waitFor();
  assert(
    !!turns[0].image,
    "current shared frame included in streaming request",
  );
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1024],
    ["mobile", 390, 844],
    ["keyboard", 390, 500],
    ["landscape", 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() => {
      const r = document
        .querySelector(".conversation-composer")
        ?.getBoundingClientRect();
      return r && r.bottom <= innerHeight + 1;
    });
    const geometry = await page.evaluate(() => {
      const c = document
          .querySelector(".conversation-composer")
          .getBoundingClientRect(),
        s = document
          .querySelector(".shared-screen-panel")
          .getBoundingClientRect(),
        scroll = document.querySelector(".conversation-scroll");
      return {
        fits:
          c.bottom <= innerHeight + 1 &&
          c.left >= 0 &&
          c.right <= innerWidth + 1,
        separate: s.right <= c.left + 1 || s.bottom <= c.top + 1,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        scrolls: scroll.scrollHeight > scroll.clientHeight,
      };
    });
    assert(
      geometry.fits && !geometry.overflow && geometry.separate,
      "preview and composer fit without overlap at " + name,
    );
    await page.screenshot({
      path: "/tmp/myn-chat-" + name + ".png",
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByLabel("Alterar idioma").click();
  await page
    .getByLabel("Idioma da conversa", { exact: true })
    .selectOption("fr");
  assert(
    !(await page
      .getByLabel("Idioma da conversa", { exact: true })
      .isDisabled()),
    "language selection stays enabled",
  );
  await page.getByLabel("Alterar idioma").click();
  const spokenResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/chat") &&
      response.request().postDataJSON()?.message ===
        "Uma pergunta falada de teste.",
    { timeout: 15000 },
  );
  await page
    .getByRole("button", { name: "Conversar por voz", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".conversation-message.assistant").length >= 2,
  );
  await page.waitForFunction(
    () => document.body.textContent.includes("Uma pergunta falada de teste."),
    { timeout: 15000 },
  );
  await spokenResponse;
  const welcomeIndex = turns.findIndex((t) => t.kind === "welcome"),
    questionIndex = turns.findIndex(
      (t) => t.message === "Uma pergunta falada de teste.",
    );
  assert(
    welcomeIndex >= 0 && questionIndex > welcomeIndex,
    "generated introduction precedes a transcribed voice turn",
  );
  await page
    .getByRole("button", { name: "Parar conversa", exact: true })
    .click();
  console.log(
    "Browser regression passed using test-only media/provider fixtures; live provider health is checked separately.",
  );
} catch (e) {
  console.error("Conversation layout verification failed: " + e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (userId) {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    if (cleanup.error) {
      console.error("Temporary test account cleanup needs attention");
      process.exitCode = 1;
    } else console.log("Temporary test account removed.");
  }
}
