// Real isolated Chromium checks against a local sandbox. No production account, model fixture or invented execution.
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import assert from "node:assert/strict";
import { startWorker } from "../worker/server.mjs";
import { sign } from "../worker/protocol.mjs";
const fixture = createServer((req, res) => {
  if (req.url === "/redirect") {
    res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" });
    res.end();
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    `<!doctype html><html><body><main><h1>Sandbox project</h1><label>Project name<input name="project" aria-label="Project name"></label><label>Region<select aria-label="Region"><option>Europe</option><option>South America</option></select></label><label>Password<input type="password" aria-label="Password"></label><button onclick="document.querySelector('h1').textContent='Project ready';document.querySelector('#result').textContent='Created '+document.querySelector('input').value">Create project</button><p id="result"></p><button disabled>Unavailable</button></main></body></html>`,
  );
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const origin = "http://127.0.0.1:" + fixture.address().port;
const secret = randomBytes(40).toString("base64url");
const worker = startWorker({ secret, port: 0, testOrigin: origin });
await once(worker, "listening");
const endpoint = "http://127.0.0.1:" + worker.address().port + "/v1/command",
  sessionId = randomUUID();
function payload(operation, action, extra = {}) {
  return {
    userId: "sandbox-user",
    taskId: "sandbox-task",
    sessionId,
    domains: ["example.com"],
    expires: Date.now() + 30000,
    nonce: randomUUID(),
    operation,
    action,
    ...extra,
  };
}
async function send(data) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: sign(data, secret) }),
  });
  return { status: r.status, ...(await r.json()) };
}
function pass(label) {
  console.log("PASS " + label);
}
try {
  const nav = await send(payload("execute", { type: "navigate", url: origin }));
  assert.equal(nav.status, 200);
  assert.ok(nav.observation.targets.some((t) => t.name === "Create project"));
  pass("real browser navigation and accessible observation");
  await send(
    payload("execute", {
      type: "fill",
      target: { role: "textbox", name: "Project name" },
      value: "MYN sandbox",
    }),
  );
  await send(
    payload("execute", {
      type: "select",
      target: { role: "combobox", name: "Region" },
      value: "South America",
    }),
  );
  const created = await send(
    payload("execute", {
      type: "click",
      target: { role: "button", name: "Create project" },
    }),
  );
  assert.ok(created.observation.text.includes("Project ready"));
  assert.ok(created.observation.text.includes("MYN sandbox"));
  pass("real fill, select, click and observable project result");
  const bad = await send(
    payload("execute", {
      type: "fill",
      target: { role: "textbox", name: "Password" },
      value: "not-stored",
    }),
  );
  assert.equal(bad.status, 409);
  pass("password fields rejected");
  assert.equal(
    (
      await send(
        payload("execute", { type: "evaluate", script: "document.cookie" }),
      )
    ).status,
    409,
  );
  pass("arbitrary script tool rejected");
  assert.equal(
    (
      await send(
        payload("execute", { type: "navigate", url: "http://169.254.169.254" }),
      )
    ).status,
    409,
  );
  pass("private network destination blocked");
  assert.equal(
    (await send(payload("observe", undefined, { userId: "another-user" })))
      .status,
    409,
  );
  pass("browser context cannot be reused by another owner");
  const nonce = payload("observe");
  assert.equal((await send(nonce)).status, 200);
  assert.equal((await send(nonce)).status, 409);
  pass("signed command replay rejected");
  assert.equal(
    (
      await send(
        payload("execute", {
          type: "click",
          target: { role: "button", name: "Changed label" },
        }),
      )
    ).status,
    409,
  );
  pass("changed interface fails safely");
  const slowStart = Date.now();
  assert.equal(
    (
      await send(
        payload("execute", {
          type: "click",
          target: { role: "button", name: "Unavailable" },
        }),
      )
    ).status,
    409,
  );
  assert.ok(Date.now() - slowStart < 11000);
  pass("disabled or slow targets fail within a bounded timeout");
  assert.equal(
    (await send(payload("close", undefined, { userId: "another-user" })))
      .status,
    409,
  );
  pass("another owner cannot revoke a browser session");

  const otherId = randomUUID();
  const fresh = await send(
    payload("observe", undefined, { sessionId: otherId }),
  );
  assert.equal(fresh.observation.url, "about:blank");
  pass("new execution sessions are isolated");
  await send(payload("close", undefined, { sessionId: otherId }));
  const waiting = send(
    payload("execute", { type: "wait", milliseconds: 3000 }),
  );
  await new Promise((r) => setTimeout(r, 100));
  await send(payload("close"));
  assert.equal((await waiting).status, 409);
  pass("closing a session interrupts in-flight execution");
  console.log(
    "Real browser engine verification complete. Live model planning and hosted-worker deployment are separate checks.",
  );
} finally {
  await new Promise((r) => worker.close(r));
  await new Promise((r) => fixture.close(r));
}
