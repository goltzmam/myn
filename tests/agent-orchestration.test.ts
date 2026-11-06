import { beforeEach, it, expect, vi } from "vitest";
import type { Task } from "../lib/agent/schema";
const m = vi.hoisted(() => ({
  task: null as any,
  granted: true,
  available: true,
  tools: 0,
  logs: [] as any[],
  browser: vi.fn(),
  plan: vi.fn(),
  decide: vi.fn(),
  identity: vi.fn(),
}));
vi.mock("@/lib/agent/browser", () => ({
  executionAvailable: () => m.available,
  browserCommand: m.browser,
}));
vi.mock("@/lib/agent/provider", () => ({
  agentProvider: () => ({ plan: m.plan, decide: m.decide, verify: vi.fn() }),
}));
vi.mock("@/lib/sessions/server", () => ({
  reserve: vi.fn(),
  context: async () => ({ history: [] }),
}));
vi.mock("@/lib/auth/server", () => ({ identity: m.identity }));
import {
  advanceTask,
  controlTask,
  actionHash,
  verifyTaskStep,
  planTask,
} from "../lib/agent/server";
import { GET, POST } from "../app/api/tasks/route";
const id = "11111111-1111-4111-8111-111111111111";
const initial = { url: "about:blank", text: "", targets: [] };
function snapshot(): Task {
  return structuredClone(m.task);
}
const client: any = {
  rpc: vi.fn(async (name: string, args: any) => {
    if (name === "agent_update") {
      if (args.p_version !== m.task.version)
        return { data: null, error: { message: "Task version conflict" } };
      m.task = { ...m.task, ...args.p_patch, version: m.task.version + 1 };
      return { data: snapshot(), error: null };
    }
    if (name === "agent_revoke") m.granted = false;
    if (name === "agent_record") m.logs.push(args);
    return { data: null, error: null };
  }),
  from: (table: string) => {
    const result = () =>
      table === "agent_permissions"
        ? {
            data: m.granted
              ? [
                  {
                    domains: m.task.domains,
                    expires_at: new Date(Date.now() + 10000).toISOString(),
                  },
                ]
              : [],
            error: null,
          }
        : table === "agent_tool_executions"
          ? { count: m.tools, error: null }
          : { data: snapshot(), error: null };
    const q: any = {
      select: () => q,
      eq: () => q,
      is: () => q,
      gt: () => q,
      order: () => q,
      limit: () => q,
      single: async () => result(),
      maybeSingle: async () => result(),
      then: (resolve: any, reject: any) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return q;
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  m.granted = true;
  m.available = true;
  m.tools = 0;
  m.logs = [];
  m.task = {
    id,
    user_id: "owner",
    session_id: id,
    objective: "Open the sandbox project",
    mode: "do",
    state: "WAITING_FOR_PERMISSION",
    summary: "Check project",
    plan: [
      {
        title: "Open project",
        success: "Project ready is visible",
        status: "pending",
      },
    ],
    domains: ["example.com"],
    step_index: 0,
    version: 0,
    pending_action: null,
    execution_id: null,
    attempts: 0,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  m.browser.mockImplementation(async (_task: any, op: string) =>
    op === "close"
      ? null
      : op === "execute"
        ? { url: "https://example.com", text: "Project ready", targets: [] }
        : initial,
  );
  m.decide.mockResolvedValue({
    decision: {
      explanation: "Open the project website",
      action: { type: "navigate", url: "https://example.com" },
      assertion: { kind: "text", value: "Project ready" },
    },
    tokens: 10,
  });
  m.plan.mockResolvedValue({
    plan: {
      summary: "A plan",
      domains: ["example.com"],
      steps: [{ title: "Open project", success: "Project ready is visible" }],
    },
    tokens: 15,
  });
  m.identity.mockResolvedValue({ client, user: { id: "owner" } });
});
it("creates a real pending action, waits for exact approval, and verifies the browser result", async () => {
  const pending = await advanceTask(
    client,
    snapshot(),
    new AbortController().signal,
  );
  expect(pending.task.state).toBe("WAITING_FOR_PERMISSION");
  expect(m.browser.mock.calls.some((c) => c[1] === "execute")).toBe(false);
  await expect(
    advanceTask(client, snapshot(), new AbortController().signal, "wrong"),
  ).rejects.toMatchObject({ code: "ACTION_APPROVAL_REQUIRED" });
  const result = await advanceTask(
    client,
    snapshot(),
    new AbortController().signal,
    actionHash(m.task.pending_action),
  );
  expect(result.task.state).toBe("COMPLETED");
  expect(result.task.plan[0].evidence).toContain("Project ready");
  expect(m.logs.some((x) => x.p_kind === "verification")).toBe(true);
});
it("blocks actions without domain permission or in guide mode", async () => {
  m.granted = false;
  await expect(
    advanceTask(client, snapshot(), new AbortController().signal),
  ).rejects.toMatchObject({ code: "PERMISSION_REQUIRED" });
  expect(m.browser).not.toHaveBeenCalled();
  m.granted = true;
  m.task.mode = "guide";
  await expect(
    advanceTask(client, snapshot(), new AbortController().signal),
  ).rejects.toMatchObject({ code: "TASK_CONFLICT" });
});
it("switches mode without losing objective, verified steps or the current step", async () => {
  m.task.state = "WAITING_FOR_USER";
  m.task.plan[0] = {
    ...m.task.plan[0],
    status: "completed",
    evidence: "You confirmed the project",
  };
  m.task.step_index = 1;
  const result = await controlTask(client, snapshot(), "mode", "together");
  expect(result.objective).toBe(m.task.objective);
  expect(result.step_index).toBe(1);
  expect(result.plan[0].evidence).toBeTruthy();
  expect(result.mode).toBe("together");
  expect(m.granted).toBe(false);
});
it("does not let a cancelled task receive a late model result", async () => {
  let release!: (v: any) => void;
  m.decide.mockImplementation(
    () => new Promise((resolve) => (release = resolve)),
  );
  const pending = advanceTask(client, snapshot(), new AbortController().signal);
  await vi.waitFor(() => expect(m.decide).toHaveBeenCalled());
  await controlTask(client, snapshot(), "cancel");
  release({
    decision: {
      explanation: "Open",
      action: { type: "navigate", url: "https://example.com" },
      assertion: { kind: "text", value: "Project ready" },
    },
    tokens: 1,
  });
  await expect(pending).rejects.toMatchObject({ code: "TASK_CONFLICT" });
  expect(m.task.state).toBe("CANCELLED");
  expect(m.browser.mock.calls.some((c) => c[1] === "execute")).toBe(false);
});
it("refuses stale page approvals after the observed page changes", async () => {
  await advanceTask(client, snapshot(), new AbortController().signal);
  const approval = actionHash(m.task.pending_action);
  m.browser.mockResolvedValue({
    url: "https://example.com/changed",
    text: "Unexpected new page",
    targets: [],
  });
  await expect(
    advanceTask(client, snapshot(), new AbortController().signal, approval),
  ).rejects.toMatchObject({ code: "ACTION_STALE" });
  expect(m.task.state).toBe("WAITING_FOR_USER");
  expect(m.granted).toBe(false);
});
it("limits failed retries and total actions before contacting the worker", async () => {
  m.task.attempts = 2;
  await expect(
    advanceTask(client, snapshot(), new AbortController().signal),
  ).rejects.toMatchObject({ code: "TASK_RETRY_LIMIT" });
  m.task.attempts = 0;
  m.tools = 50;
  await expect(
    advanceTask(client, snapshot(), new AbortController().signal),
  ).rejects.toMatchObject({ code: "TASK_ACTION_LIMIT" });
  expect(m.browser).not.toHaveBeenCalled();
});
it("does not finish a step just because an action ran", async () => {
  await advanceTask(client, snapshot(), new AbortController().signal);
  m.browser.mockImplementation(async (_t: any, op: string) =>
    op === "execute"
      ? { url: "https://example.com", text: "Still loading", targets: [] }
      : initial,
  );
  const result = await advanceTask(
    client,
    snapshot(),
    new AbortController().signal,
    actionHash(m.task.pending_action),
  );
  expect(result.task.state).toBe("RUNNING");
  expect(result.task.plan[0].status).toBe("pending");
});
it("records explicit user evidence and finishes only after verification", async () => {
  m.task.state = "WAITING_FOR_USER";
  m.task.mode = "guide";
  const result = await verifyTaskStep(
    client,
    snapshot(),
    { evidence: "The sandbox project is ready" },
    new AbortController().signal,
  );
  expect(result.state).toBe("COMPLETED");
  expect(result.plan[0].source).toBe("user");
  expect(m.granted).toBe(false);
});
it("keeps a failed planning task recoverable", async () => {
  m.task.state = "CREATED";
  m.plan.mockRejectedValue(new Error("Provider disconnected"));
  await expect(
    planTask(client, snapshot(), new AbortController().signal),
  ).rejects.toThrow();
  expect(m.task.state).toBe("FAILED");
});
it("protects task APIs against signed-out callers and cross-origin writes", async () => {
  m.identity.mockRejectedValue(new Error("Unauthorized"));
  expect((await GET(new Request("https://myn.example/api/tasks"))).status).toBe(
    401,
  );
  expect(
    (
      await POST(
        new Request("https://myn.example/api/tasks", {
          method: "POST",
          headers: { origin: "https://evil.example" },
          body: "{}",
        }),
      )
    ).status,
  ).toBe(403);
});
it("avoids another model call when automatic observation is unchanged", async () => {
  m.task.state = "RUNNING";
  m.task.observation_hash = actionHash(initial);
  const result = await advanceTask(
    client,
    snapshot(),
    new AbortController().signal,
  );
  expect(result.task.state).toBe("WAITING_FOR_USER");
  expect(m.decide).not.toHaveBeenCalled();
});
it("will not execute if domain access expires after observation", async () => {
  await advanceTask(client, snapshot(), new AbortController().signal);
  const approval = actionHash(m.task.pending_action);
  m.browser.mockImplementation(async () => {
    m.granted = false;
    return initial;
  });
  await expect(
    advanceTask(client, snapshot(), new AbortController().signal, approval),
  ).rejects.toMatchObject({ code: "PERMISSION_REQUIRED" });
  expect(m.browser.mock.calls.filter((c) => c[1] === "execute")).toHaveLength(
    0,
  );
});
