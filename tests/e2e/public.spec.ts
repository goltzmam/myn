import { test, expect } from "@playwright/test";
test("landing and signup navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The AI that shows you where to click.",
  );
  await page.getByRole("link", { name: "Get started free" }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});
test("application requires authentication", async ({ page }) => {
  await page.goto("/app/guide");
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
test("billing webhook rejects unconfigured or unsigned requests", async ({
  request,
}) => {
  const res = await request.post("/api/billing/webhook", { data: {} });
  expect([400, 503]).toContain(res.status());
});
test("cross-origin AI request is rejected", async ({ request }) => {
  const res = await request.post("/api/assist", {
    headers: { origin: "https://untrusted.example" },
    data: {},
  });
  expect(res.status()).toBe(403);
});
test("mobile landing has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("public pages resolve and legal text describes capture", async ({
  page,
}) => {
  for (const path of [
    "/features",
    "/how-it-works",
    "/pricing",
    "/download",
    "/privacy",
    "/terms",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
  }
  await page.goto("/privacy");
  await expect(page.getByText(/does not save screenshots/)).toBeVisible();
});
test("offline shell is available without caching private pages", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.goto("/app/guide");
  await expect(
    page.getByRole("heading", { name: "A little pause in the flow." }),
  ).toBeVisible();
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map(
            (request) => new URL(request.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  expect(cached.sort()).toEqual(["/icon.svg", "/offline.html"]);
  await context.setOffline(false);
});
test("dashboard also redirects without credentials", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});
