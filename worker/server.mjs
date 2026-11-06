import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { verify } from "./protocol.mjs";
import { createBrowserSession } from "./browser.mjs";
export function startWorker({
  secret,
  port = 3040,
  host = "127.0.0.1",
  testOrigin,
} = {}) {
  if (!secret || secret.length < 32)
    throw new Error(
      "A server-only worker signing secret of at least 32 characters is required",
    );
  if (
    (process.env.NODE_ENV === "production" && testOrigin) ||
    (!testOrigin && process.env.MYN_BROWSER_EGRESS_CONFIRMED !== "1")
  )
    throw new Error(
      "The worker requires enforced outbound isolation. A local test origin is allowed only outside production.",
    );
  const sessions = new Map(),
    seen = new Map();
  async function close(id) {
    const session = sessions.get(id);
    sessions.delete(id);
    await session?.browser.close().catch(() => {});
  }
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.method !== "POST" || req.url !== "/v1/command")
        throw new Error("Not found");
      let body = "";
      for await (const part of req) {
        body += part;
        if (body.length > 64000) throw new Error("Payload too large");
      }
      const { token } = JSON.parse(body),
        grant = verify(token, secret);
      if (seen.has(grant.nonce)) throw new Error("Authorization already used");
      seen.set(grant.nonce, grant.expires);
      if (grant.operation === "close") {
        const existing = sessions.get(grant.sessionId);
        if (
          existing &&
          (existing.userId !== grant.userId || existing.taskId !== grant.taskId)
        )
          throw new Error("Browser scope conflict");
        await close(grant.sessionId);
        res.end(JSON.stringify({ closed: true }));
        return;
      }
      if (!["observe", "execute"].includes(grant.operation))
        throw new Error("Unknown operation");
      let session = sessions.get(grant.sessionId);
      if (!session) {
        if (sessions.size >= 4) throw new Error("Worker is busy");
        session = {
          userId: grant.userId,
          taskId: grant.taskId,
          domains: JSON.stringify(grant.domains),
          busy: true,
          browser: null,
          expires: Date.now() + 600000,
        };
        sessions.set(grant.sessionId, session);
        try {
          session.browser = await createBrowserSession(grant.domains, {
            testOrigin,
          });
        } catch (e) {
          sessions.delete(grant.sessionId);
          throw e;
        }
        session.busy = false;
      }
      if (
        session.userId !== grant.userId ||
        session.taskId !== grant.taskId ||
        session.domains !== JSON.stringify(grant.domains) ||
        session.busy
      )
        throw new Error("Browser scope conflict");
      session.busy = true;
      session.expires = Date.now() + 600000;
      res.on("close", () => {
        if (!res.writableEnded) void close(grant.sessionId);
      });
      try {
        const observation =
          grant.operation === "execute"
            ? await session.browser.execute(grant.action)
            : await session.browser.observe(true);
        res.end(JSON.stringify({ observation }));
      } finally {
        session.busy = false;
      }
    } catch {
      res.statusCode = 409;
      res.end(
        JSON.stringify({
          error:
            "The browser action was blocked or interrupted. Review the task and try again.",
        }),
      );
    }
  });
  const reap = setInterval(() => {
    for (const [id, s] of sessions) if (s.expires < Date.now()) void close(id);
    for (const [n, expiry] of seen) if (expiry < Date.now()) seen.delete(n);
  }, 10000);
  reap.unref();
  server.on("close", () => {
    clearInterval(reap);
    for (const id of sessions.keys()) void close(id);
  });
  server.listen(port, host);
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startWorker({
    secret: process.env.MYN_WORKER_SECRET,
    port: Number(process.env.MYN_WORKER_PORT || 3040),
    host: process.env.MYN_WORKER_HOST || "127.0.0.1",
  });
  console.log(
    "MYN isolated browser worker started. Request bodies and credentials are never logged.",
  );
}
