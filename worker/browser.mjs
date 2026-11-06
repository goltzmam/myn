import { chromium } from "playwright";
import { lookup } from "node:dns/promises";
import { actionSchema } from "../lib/agent/schema.ts";
import { publicAddress, validateDestination, safeText } from "./protocol.mjs";
export async function createBrowserSession(domains, options = {}) {
  const testOrigin = options.testOrigin;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
  });
  const context = await browser.newContext({
    acceptDownloads: false,
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "block",
    permissions: [],
  });
  let writes = 0,
    requests = 0,
    closed = false;
  async function guard(raw) {
    const url = validateDestination(raw, domains, testOrigin);
    if (!testOrigin || url.origin !== testOrigin) {
      const addresses = await lookup(url.hostname, { all: true });
      if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
        throw new Error("Private destination blocked");
    }
    return url;
  }
  // All browser networking goes through this validated transport, including redirects/subresources.
  // Native Node fetch preserves the environment proxy and trusted CA; TLS stays enabled.
  await context.route("**/*", async (route) => {
    try {
      const request = route.request();
      if (++requests > 250) throw new Error("Request budget exceeded");
      await guard(request.url());
      if (!["GET", "HEAD"].includes(request.method()) && writes-- <= 0)
        throw new Error("Write requires an approved action");
      const headers = { ...request.headers() };
      for (const h of [
        "host",
        "content-length",
        "connection",
        "proxy-authorization",
      ])
        delete headers[h];
      const response = await fetch(request.url(), {
        method: request.method(),
        headers,
        body: ["GET", "HEAD"].includes(request.method())
          ? undefined
          : request.postDataBuffer(),
        redirect: "manual",
        signal: AbortSignal.timeout(12000),
      });
      if (/attachment/i.test(response.headers.get("content-disposition") || ""))
        throw new Error("Downloads are disabled");
      const chunks = [];
      let size = 0;
      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 4_000_000) {
              await reader.cancel();
              throw new Error("Resource exceeds limit");
            }
            chunks.push(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
        }
      }
      const body = Buffer.concat(chunks);
      const resultHeaders = Object.fromEntries(response.headers);
      for (const h of [
        "content-length",
        "content-encoding",
        "transfer-encoding",
      ])
        delete resultHeaders[h];
      if (response.headers.getSetCookie?.().length)
        resultHeaders["set-cookie"] = response.headers
          .getSetCookie()
          .join("\n");
      await route.fulfill({
        status: response.status,
        headers: resultHeaders,
        body: Buffer.from(body),
      });
    } catch {
      await route.abort("blockedbyclient").catch(() => {});
    }
  });
  await context.routeWebSocket("**/*", (socket) => socket.close());
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.setDefaultNavigationTimeout(14000);
  context.on("page", (popup) => {
    if (popup !== page) void popup.close();
  });
  page.on("dialog", (dialog) => void dialog.dismiss());
  page.on("download", (download) => void download.cancel());
  async function observe(screenshot = false) {
    if (closed) throw new Error("Browser session closed");
    const data = await page.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      const nodes = [
        ...document.querySelectorAll("button,a,input,select,textarea,[role]"),
      ]
        .filter((el) => el.getClientRects().length > 0)
        .slice(0, 100);
      const targets = nodes
        .map((el) => {
          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute("type") || "";
          const role =
            el.getAttribute("role") ||
            (tag === "button"
              ? "button"
              : tag === "a"
                ? "link"
                : tag === "select"
                  ? "combobox"
                  : type === "checkbox"
                    ? "checkbox"
                    : type === "radio"
                      ? "radio"
                      : "textbox");
          const labels =
            "labels" in el
              ? [...(el.labels || [])].map((l) => l.textContent).join(" ")
              : "";
          const name =
            el.getAttribute("aria-label") ||
            labels ||
            (["input", "textarea", "select"].includes(tag)
              ? ""
              : el.textContent) ||
            el.getAttribute("placeholder") ||
            "";
          return { role, name: name.trim().slice(0, 180) };
        })
        .filter((t) => t.name);
      // Input values, page HTML, cookies and storage are never observed or logged.
      return { text: (main?.innerText || "").slice(0, 10000), targets };
    });
    return {
      url: page.url(),
      text: safeText(data.text),
      targets: data.targets.map((t) => ({ ...t, name: safeText(t.name) })),
      ...(screenshot
        ? {
            screenshot:
              "data:image/jpeg;base64," +
              (
                await page.screenshot({
                  type: "jpeg",
                  quality: 45,
                  scale: "css",
                  animations: "disabled",
                })
              ).toString("base64"),
          }
        : {}),
    };
  }
  async function execute(raw) {
    if (closed) throw new Error("Browser session closed");
    const action = actionSchema.parse(raw);
    requests = 0;
    writes = ["click", "fill", "select"].includes(action.type) ? 3 : 0;
    try {
      if (action.type === "navigate") {
        await guard(action.url);
        await page.goto(action.url, { waitUntil: "domcontentloaded" });
      } else if (["click", "fill", "select"].includes(action.type)) {
        const locator = page.getByRole(action.target.role, {
          name: action.target.name,
          exact: true,
        });
        if ((await locator.count()) !== 1)
          throw new Error(
            "Target missing or ambiguous; review the updated page",
          );
        const sensitive = await locator.evaluate((el) => {
          const description = [
            "type",
            "name",
            "autocomplete",
            "aria-label",
            "id",
          ]
            .map((k) => el.getAttribute(k) || "")
            .join(" ");
          return /password|secret|token|api.?key|credit|card.?number|cc-|one.?time|otp|social.?security/i.test(
            description,
          );
        });
        if (sensitive) throw new Error("Sensitive fields require the user");
        if (action.type === "click") await locator.click({ noWaitAfter: true });
        else if (action.type === "fill") {
          if (/sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_.-]{30,}/.test(action.value))
            throw new Error("Sensitive values are not accepted");
          await locator.fill(action.value);
        } else await locator.selectOption({ label: action.value });
      } else if (action.type === "scroll")
        await page.mouse.wheel(0, action.direction === "down" ? 600 : -600);
      else if (action.type === "wait")
        await page.waitForTimeout(action.milliseconds);
      await page
        .waitForLoadState("domcontentloaded", { timeout: 5000 })
        .catch(() => {});
      return await observe(true);
    } finally {
      writes = 0;
    }
  }
  return {
    observe,
    execute,
    async close() {
      closed = true;
      await browser.close();
    },
  };
}
