// Real, disposable-account verification. Uses credentials in memory only; never writes or prints them.
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !anon || !token)
  throw new Error("Secure Supabase configuration is required.");
const ref = new URL(url).hostname.split(".")[0];
const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/api-keys`,
  { headers: { Authorization: "Bearer " + token } },
);
if (!response.ok)
  throw new Error("Could not access project keys. HTTP " + response.status);
const keys = await response.json();
const service = keys.find((k) => k.name === "service_role")?.api_key;
if (!service)
  throw new Error("No administrative key is available for this project.");
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const created = [];
function assert(value, label) {
  if (!value) throw new Error("Failed: " + label);
  console.log("PASS " + label);
}
async function makeUser() {
  const email = `readiness-${randomUUID()}@checks.myn.invalid`,
    password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error("Temporary account creation failed");
  created.push(data.user.id);
  const jar = new Map();
  const client = createServerClient(url, anon, {
    cookies: {
      getAll: () =>
        [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll(items) {
        items.forEach(({ name, value }) => jar.set(name, value));
      },
    },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error("Temporary sign-in failed");
  return {
    id: data.user.id,
    client,
    cookie: () => [...jar.entries()].map(([k, v]) => k + "=" + v).join("; "),
  };
}
try {
  const a = await makeUser(),
    b = await makeUser();
  assert(true, "real email/password sign-in with confirmed temporary accounts");
  const profile = await a.client
    .from("profiles")
    .select("id")
    .eq("id", a.id)
    .single();
  assert(!profile.error && profile.data?.id === a.id, "signup profile trigger");
  const session = await a.client
    .from("sessions")
    .insert({
      user_id: a.id,
      mode: "wake",
      title: "Disposable readiness check",
      objective: "Infrastructure test, not a generated conversation",
    })
    .select("id")
    .single();
  assert(!session.error && session.data?.id, "authenticated session creation");
  const id = session.data.id;
  const denied = await b.client.from("sessions").select("id").eq("id", id);
  assert(
    !denied.error && denied.data.length === 0,
    "cross-user reads blocked by RLS",
  );
  const forged = await b.client
    .from("sessions")
    .insert({ user_id: a.id, mode: "wake" });
  assert(!!forged.error, "cross-user writes rejected");
  const turn = randomUUID();
  const q = await a.client.rpc("save_question", {
    p_session: id,
    p_turn: turn,
    p_question: "تمرين بنية تحتية · こんにちは",
  });
  assert(!q.error, "original-language transcript persisted");
  const s = await a.client.rpc("save_exchange", {
    p_session: id,
    p_turn: turn,
    p_question: "تمرين بنية تحتية · こんにちは",
    p_reply: "Readiness fixture only; not an AI response.",
    p_steps: [],
    p_summary: "Disposable infrastructure test.",
    p_tokens: 0,
  });
  assert(!s.error, "atomic answer and summary persistence");
  const messages = await a.client
    .from("messages")
    .select("id")
    .eq("session_id", id);
  assert(
    !messages.error && messages.data.length === 2,
    "private history retrieval",
  );
  const other = await b.client
    .from("messages")
    .select("id")
    .eq("session_id", id);
  assert(
    !other.error && other.data.length === 0,
    "transcript ownership isolation",
  );
  const quota = await a.client.rpc("reserve_usage", {
    p_session: id,
    p_kind: "analysis",
  });
  assert(!quota.error, "persistent usage accounting");
  const subscription = await a.client
    .from("subscriptions")
    .insert({ user_id: a.id, plan_id: "max", status: "active" });
  assert(!!subscription.error, "client cannot grant its own paid subscription");
  if (process.env.MYN_TEST_ORIGIN) {
    const origin = process.env.MYN_TEST_ORIGIN;
    const r = await fetch(origin + "/api/sessions", {
      method: "POST",
      headers: {
        origin,
        cookie: a.cookie(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "wake",
        objective: "Disposable authenticated API check",
      }),
    });
    if (r.status !== 200) {
      let e;
      try {
        e = await r.json();
      } catch {}
      console.log(
        "Signed-cookie API diagnostic: " +
          JSON.stringify({
            status: r.status,
            code: e?.code,
            cookieCount: a.cookie().split("; ").length,
          }),
      );
    }
    assert(r.status === 200, "real signed-cookie session API");
    const page = await fetch(origin + "/app", {
      headers: { cookie: a.cookie() },
    });
    assert(
      page.status === 200 &&
        !(await page.text()).includes(
          "Seu histórico ainda não está disponível",
        ),
      "authenticated Home without database warning",
    );
  }
  if (process.env.MYN_PROVIDER_CHECK === "1" && process.env.MYN_TEST_ORIGIN) {
    const origin = process.env.MYN_TEST_ORIGIN;
    const health = await fetch(origin + "/api/conversation/status", {
      headers: { cookie: a.cookie() },
    });
    const state = await health.json();
    console.log("Deployment conversation state: " + JSON.stringify(state));
    const probe = await fetch(origin + "/api/conversation/status", {
      method: "POST",
      headers: { origin, cookie: a.cookie() },
    });
    const outcome = await probe.json();
    console.log(
      "Live provider probe: " +
        JSON.stringify({
          status: probe.status,
          code: outcome.code || null,
          connected: outcome.connected === true,
        }),
    );
  }
  if (process.env.MYN_SCREENSHOTS === "1" && process.env.MYN_TEST_ORIGIN) {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      headless: true,
    });
    try {
      const origin = process.env.MYN_TEST_ORIGIN;
      const browserContext = await browser.newContext({
        viewport: { width: 1440, height: 1050 },
      });
      await browserContext.addCookies(
        a
          .cookie()
          .split("; ")
          .map((entry) => {
            const i = entry.indexOf("=");
            return {
              name: entry.slice(0, i),
              value: entry.slice(i + 1),
              url: origin,
            };
          }),
      );
      // Keep TLS verification on: native fetch uses the environment's trusted proxy.
      // This test-only bridge forwards unchanged browser requests to the real project.
      await browserContext.route(url + "/**", async (route) => {
        const request = route.request();
        const headers = { ...request.headers() };
        delete headers.host;
        delete headers["content-length"];
        const result = await fetch(request.url(), {
          method: request.method(),
          headers,
          ...(request.method() === "GET" || request.method() === "HEAD"
            ? {}
            : { body: request.postDataBuffer() }),
        });
        const out = Object.fromEntries(result.headers.entries());
        for (const key of [
          "content-encoding",
          "content-length",
          "transfer-encoding",
        ])
          delete out[key];
        await route.fulfill({
          status: result.status,
          headers: out,
          body: Buffer.from(await result.arrayBuffer()),
        });
      });
      const page = await browserContext.newPage();
      await page.goto(origin + "/app");
      await page.getByRole("link", { name: "Open Elo", exact: true }).waitFor();
      await page.screenshot({
        path: "/tmp/myn-home-premium.png",
        fullPage: true,
      });
      await page.goto(origin + "/app/elo");
      await page
        .getByRole("button", { name: "Talk by voice", exact: true })
        .waitFor();
      await page.screenshot({
        path: "/tmp/myn-elo-premium.png",
        fullPage: true,
      });
      await page.goto(origin + "/app/settings/history");
      await page
        .getByRole("navigation", { name: "Settings sections" })
        .waitFor();
      await page
        .getByRole("heading", {
          name: "Disposable readiness check",
          exact: true,
        })
        .waitFor();
      await page.screenshot({
        path: "/tmp/myn-settings-premium.png",
        fullPage: true,
      });
      assert(
        true,
        "authenticated Home, Elo, and settings history rendered in Chromium",
      );
    } finally {
      await browser.close();
    }
  }
  const deletion = await b.client.rpc("delete_own_account");
  assert(
    !deletion.error,
    "self-service account deletion without a service secret in the app",
  );
  console.log(
    "Infrastructure verified. Paid voice/vision is validated separately.",
  );
} catch (e) {
  console.error("Platform verification failed:", e.message);
  process.exitCode = 1;
} finally {
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) {
      console.error("Temporary account cleanup requires attention");
      process.exitCode = 1;
    }
  }
  console.log("Temporary account cleanup complete.");
}
