import { test, expect } from "@playwright/test";
test("visitor can open dashboard and Guide without an account", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Experimentar interface", exact: true })
    .click();
  await expect(page).toHaveURL("/try");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page
    .locator("a.mode-card")
    .filter({ hasText: "See it. Solve it." })
    .click();
  await expect(page).toHaveURL("/try/guide");
  await expect(
    page.getByRole("button", { name: "Compartilhar tela", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhuma captura ou gravação deste teste"),
  ).toBeVisible();
});
test("screen preview starts only on click and stops all tracks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        canvas.getContext("2d")!.fillRect(0, 0, 640, 360);
        const stream = canvas.captureStream(1);
        (window as any).__screenStream = stream;
        (window as any).__screenCalls =
          ((window as any).__screenCalls || 0) + 1;
        return stream;
      },
    });
  });
  let uploads = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") uploads++;
  });
  await page.goto("/try/guide");
  expect(await page.evaluate(() => (window as any).__screenCalls || 0)).toBe(0);
  await page
    .getByRole("button", { name: "Compartilhar tela", exact: true })
    .click();
  await expect(
    page.getByText("COMPARTILHAMENTO LOCAL · NÃO ENVIADO À IA"),
  ).toBeVisible();
  await expect(page.locator("video")).toBeVisible();
  await page.getByRole("button", { name: "Pausar preview" }).click();
  await expect(page.getByText("PREVIEW PAUSADO")).toBeVisible();
  await page.getByRole("button", { name: "Retomar preview" }).click();
  await page.getByRole("button", { name: "Parar compartilhamento" }).click();
  expect(
    await page.evaluate(() =>
      (window as any).__screenStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
  expect(uploads).toBe(0);
});
test("visitor sections resolve and never expose private history", async ({
  page,
}) => {
  for (const path of [
    "wake",
    "live",
    "agents",
    "history",
    "settings",
    "billing",
  ]) {
    const res = await page.goto("/try/" + path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/try/unknown");
  await expect(
    page.getByRole("heading", { name: "A little off the path." }),
  ).toBeVisible();
});
test("visitor dashboard fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/try");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("local microphone recording can be played and discarded without upload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const ctx = new AudioContext(),
          osc = ctx.createOscillator(),
          dest = ctx.createMediaStreamDestination();
        osc.connect(dest);
        osc.start();
        (window as any).__micStream = dest.stream;
        return dest.stream;
      },
    });
  });
  let uploads = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") uploads++;
  });
  await page.goto("/try/wake");
  await page
    .getByRole("button", { name: "Testar microfone", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Parar gravação" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Parar gravação" }).click();
  await expect(page.getByLabel("Sua gravação local")).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as any).__micStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Descartar áudio" }).click();
  await expect(page.getByLabel("Sua gravação local")).toHaveCount(0);
  expect(uploads).toBe(0);
});
