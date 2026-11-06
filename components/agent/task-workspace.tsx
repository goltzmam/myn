"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Circle,
  LoaderCircle,
  Pause,
  Play,
  ShieldCheck,
  X,
  ListChecks,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import type { Mode, Observation, Task } from "@/lib/agent/schema";
const labels: Record<Mode, string> = {
  guide: "Guide me",
  do: "Do it for me",
  together: "Let's do it together",
};
const states: Record<string, string> = {
  CREATED: "Ready to plan",
  PLANNING: "Planning",
  WAITING_FOR_PERMISSION: "Waiting for your approval",
  RUNNING: "Working in your browser",
  WAITING_FOR_USER: "Your turn",
  VERIFYING: "Checking the result",
  COMPLETED: "Verified and finished",
  FAILED: "Needs your attention",
  CANCELLED: "Cancelled",
};
async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    signal: AbortSignal.any([
      AbortSignal.timeout(init?.method ? 55000 : 15000),
      ...(init?.signal ? [init.signal] : []),
    ]),
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "The task could not be updated.");
  return d;
}
export function TaskWorkspace({
  sessionId,
  objective,
  ensureSession,
  capture,
}: {
  sessionId?: string;
  objective: string;
  ensureSession: (objective: string) => Promise<string>;
  capture: () => Promise<string | undefined>;
}) {
  const [task, setTask] = useState<Task | null>(null),
    [mode, setMode] = useState<Mode>("together"),
    [expanded, setExpanded] = useState(false),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [available, setAvailable] = useState(false),
    [domains, setDomains] = useState(""),
    [evidence, setEvidence] = useState(""),
    [hash, setHash] = useState<string | null>(null),
    [observation, setObservation] = useState<Observation | null>(null),
    [previous, setPrevious] = useState<Task[]>([]),
    [amending, setAmending] = useState(false),
    [steps, setSteps] = useState("");
  const current = useRef(task),
    controller = useRef<AbortController | null>(null),
    live = useRef(true);
  current.current = task;
  const terminal = !!task && ["COMPLETED", "CANCELLED"].includes(task.state);
  function accept(data: any) {
    if (!live.current) return;
    if (data.task) {
      setTask(data.task);
      setMode(data.task.mode);
      setDomains(data.task.domains.join(", "));
      setHash(data.actionHash || null);
    }
    if (data.observation) setObservation(data.observation);
    if (typeof data.executionAvailable === "boolean")
      setAvailable(data.executionAvailable);
  }
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    api("/api/tasks?session=" + encodeURIComponent(sessionId))
      .then((data) => {
        if (!active) return;
        setAvailable(data.executionAvailable);
        const requested = new URLSearchParams(location.search).get("task");
        const found =
          data.tasks?.find((t: Task) => t.id === requested) || data.tasks?.[0];
        if (found && !current.current) {
          setTask(found);
          setMode(found.mode);
          setDomains(found.domains.join(", "));
          if (found.pending_action)
            void api("/api/tasks/" + found.id)
              .then((data) => {
                if (active) accept(data);
              })
              .catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [sessionId]);
  async function refresh() {
    if (!current.current) return;
    accept(await api("/api/tasks/" + current.current.id));
  }
  async function command(name: string, extra: Record<string, unknown> = {}) {
    const active = current.current;
    if (!active) return;
    const control = ["pause", "cancel", "revoke", "mode"].includes(name);
    if (busy && !control) return;
    setBusy(true);
    setError("");
    const aborter = new AbortController();
    if (!control) controller.current = aborter;
    try {
      const data = await api("/api/tasks/" + active.id, {
        method: "POST",
        body: JSON.stringify({
          command: name,
          version: active.version,
          ...extra,
        }),
        signal: aborter.signal,
      });
      if (control) controller.current?.abort();
      accept(data);
      if (["pause", "cancel", "revoke", "mode"].includes(name))
        setObservation(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        await refresh().catch(() => {});
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  // One bounded server iteration at a time. Approval, user input, errors, or pause stop this loop.
  useEffect(() => {
    if (!task || task.state !== "RUNNING" || busy || error) return;
    const timer = setTimeout(() => void command("advance"), 1200);
    return () => clearTimeout(timer);
  }, [task?.version, busy, error]);
  async function create() {
    let createdSession: string | undefined;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const value = (draft || objective).trim();
      if (value.length < 3)
        throw new Error("Tell me what you would like to get done.");
      const id = await ensureSession(value);
      createdSession = id;
      accept(
        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ sessionId: id, objective: value, mode }),
          signal: controller.current.signal,
        }),
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        if (createdSession) {
          const saved = await api("/api/tasks?session=" + createdSession).catch(
            () => null,
          );
          if (saved?.tasks?.[0])
            accept({
              task: saved.tasks[0],
              executionAvailable: saved.executionAvailable,
            });
        }
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function resumeList() {
    try {
      const data = await api("/api/tasks");
      setAvailable(data.executionAvailable);
      setPrevious(data.tasks || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function switchMode(value: Mode) {
    if (task && !terminal) {
      void command("mode", { mode: value });
    } else setMode(value);
  }
  return (
    <section
      className={"agent-workspace " + (expanded ? "task-expanded" : "")}
      aria-label="Task workspace"
    >
      <div className="agent-task-heading">
        <button
          type="button"
          className="agent-task-toggle"
          aria-label={task ? "Review task: " + task.objective : "Start a task"}
          aria-expanded={expanded}
          onClick={() => {
            setExpanded(!expanded);
            if (!task && !expanded) {
              setDraft(objective);
              void resumeList();
            }
          }}
        >
          <ListChecks size={16} />
          <span>{task ? task.objective : "Start a task"}</span>
          {task && (
            <small>
              {task.step_index}/{task.plan.length}
            </small>
          )}
          <ChevronDown size={13} />
        </button>
        {task && !terminal && (
          <button
            type="button"
            className="task-quick-pause"
            aria-label="Pause task"
            onClick={() => void command("pause")}
          >
            <Pause size={14} />
          </button>
        )}
      </div>
      <div className="agent-modes" role="group" aria-label="How we work">
        {(Object.entries(labels) as [Mode, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={(task?.mode || mode) === value}
            disabled={busy && !task}
            onClick={() => switchMode(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {expanded && (
        <div className="agent-task-details">
          <header>
            <strong>
              {task ? states[task.state] : "What would you like to get done?"}
            </strong>
            <button
              type="button"
              aria-label="Close task details"
              onClick={() => setExpanded(false)}
            >
              <X size={17} />
            </button>
          </header>
          {(error || task?.error) && (
            <p className="agent-error" role="alert">
              {error || task?.error}
            </p>
          )}
          {!task ? (
            <>
              <label className="agent-objective">
                Your goal
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={4000}
                  rows={2}
                  placeholder="Help me configure my website"
                />
              </label>
              <button
                type="button"
                className="agent-primary"
                disabled={busy}
                onClick={() => void create()}
              >
                {busy ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <ListChecks size={14} />
                )}
                Make a plan
              </button>
              {previous.length > 0 && (
                <div className="agent-resume">
                  <span>Pick up where you left off</span>
                  {previous
                    .filter(
                      (t) => !["COMPLETED", "CANCELLED"].includes(t.state),
                    )
                    .slice(0, 5)
                    .map((t) => (
                      <Link
                        key={t.id}
                        href={
                          "/app/elo?session=" + t.session_id + "&task=" + t.id
                        }
                      >
                        {t.objective}
                        <ArrowUpRight size={13} />
                      </Link>
                    ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="agent-summary">{task.summary || task.objective}</p>
              <ol className="agent-steps">
                {task.plan.map((step, index) => (
                  <li
                    key={index}
                    className={index === task.step_index ? "current-step" : ""}
                  >
                    {step.status === "completed" ? (
                      <Check size={15} />
                    ) : (
                      <Circle size={13} />
                    )}
                    <div>
                      <span>{step.title}</span>
                      {index === task.step_index && (
                        <small>{step.success}</small>
                      )}
                      {step.evidence && (
                        <small className="agent-evidence">
                          {step.source === "user"
                            ? "You confirmed: "
                            : "Verified: "}
                          {step.evidence}
                        </small>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {!terminal && (
                <>
                  {task.mode !== "guide" && (
                    <div className="agent-access">
                      {!available ? (
                        <p>
                          Browser actions are not connected yet. Choose Guide me
                          to continue together.
                        </p>
                      ) : (
                        <>
                          <label>
                            Allowed websites
                            <input
                              aria-label="Allowed websites"
                              value={domains}
                              onChange={(e) => setDomains(e.target.value)}
                              placeholder="example.com, app.example.com"
                            />
                          </label>
                          <p>
                            A separate browser, only on these websites. Access
                            expires after 30 minutes. Every navigation, click
                            and form change needs your review.
                          </p>
                          <button
                            type="button"
                            disabled={busy || !domains.trim()}
                            onClick={() =>
                              void command("grant", {
                                domains: domains
                                  .split(",")
                                  .map((d) => d.trim().toLowerCase())
                                  .filter(Boolean),
                              })
                            }
                          >
                            <ShieldCheck size={14} />
                            Allow these websites
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {task.pending_action && (
                    <div className="agent-action-review">
                      <strong>Review the next action</strong>
                      <p>{task.pending_action.explanation}</p>
                      <code>
                        {task.pending_action.action?.type}
                        {task.pending_action.action?.type === "navigate"
                          ? ": " + task.pending_action.action.url
                          : task.pending_action.action &&
                              "target" in task.pending_action.action
                            ? ": " + task.pending_action.action.target.name
                            : ""}
                      </code>
                      {task.pending_action.action &&
                        "value" in task.pending_action.action && (
                          <p>Value: {task.pending_action.action.value}</p>
                        )}
                      <small>
                        Check result: {task.pending_action.assertion.value}
                      </small>
                      <p>
                        Only approve if you intend this action, including any
                        submission or change it makes.
                      </p>
                      <button
                        type="button"
                        className="agent-primary"
                        disabled={busy}
                        onClick={async () => {
                          if (!hash) {
                            await refresh();
                            return;
                          }
                          void command("approve", { approval: hash });
                        }}
                      >
                        Approve this action
                      </button>
                    </div>
                  )}
                  {task.mode !== "guide" &&
                    available &&
                    !task.pending_action &&
                    ["WAITING_FOR_PERMISSION", "RUNNING"].includes(
                      task.state,
                    ) && (
                      <button
                        type="button"
                        className="agent-primary"
                        disabled={busy}
                        onClick={() => void command("advance")}
                      >
                        <Play size={14} />
                        {busy ? "Working…" : "Review next action"}
                      </button>
                    )}
                  {["WAITING_FOR_USER", "FAILED"].includes(task.state) &&
                    task.plan.length > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void command("resume")}
                      >
                        Continue task
                      </button>
                    )}
                  {task.state === "FAILED" && task.plan.length === 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void command("plan")}
                    >
                      Try planning again
                    </button>
                  )}
                  {task.plan[task.step_index] &&
                    ["WAITING_FOR_USER", "WAITING_FOR_PERMISSION"].includes(
                      task.state,
                    ) && (
                      <details className="agent-verify">
                        <summary>Check this step</summary>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            try {
                              const image = await capture();
                              if (!image) {
                                setError(
                                  "Share the relevant screen first, or confirm the result below.",
                                );
                                return;
                              }
                              void command("verify", { image });
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Check the shared screen
                        </button>
                        <label>
                          Or describe the result you confirmed
                          <input
                            value={evidence}
                            onChange={(e) => setEvidence(e.target.value)}
                            placeholder="The project is listed as ready"
                            maxLength={500}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy || evidence.trim().length < 3}
                          onClick={() => {
                            void command("confirm", { evidence });
                            setEvidence("");
                          }}
                        >
                          I confirm this result
                        </button>
                      </details>
                    )}
                  {task.state === "WAITING_FOR_USER" &&
                    task.plan.length > 0 && (
                      <details
                        className="agent-amend"
                        open={amending}
                        onToggle={(e) => setAmending(e.currentTarget.open)}
                      >
                        <summary
                          onClick={() => {
                            if (!amending)
                              setSteps(
                                task.plan
                                  .slice(task.step_index)
                                  .map((s) => s.title + " | " + s.success)
                                  .join("\n"),
                              );
                          }}
                        >
                          Adjust remaining steps
                        </summary>
                        <label>
                          One step per line: action | success criterion
                          <textarea
                            rows={4}
                            value={steps}
                            onChange={(e) => setSteps(e.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const remaining = steps
                              .split("\n")
                              .filter((s) => s.trim())
                              .map((s) => {
                                const [title, ...success] = s.split("|");
                                return {
                                  title: title.trim(),
                                  success: success.join("|").trim(),
                                };
                              });
                            void command("amend", { steps: remaining });
                          }}
                        >
                          Save remaining steps
                        </button>
                      </details>
                    )}
                  <div className="agent-controls">
                    <button type="button" onClick={() => void command("pause")}>
                      <Pause size={13} />
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => void command("revoke")}
                    >
                      Revoke access
                    </button>
                    <button
                      type="button"
                      onClick={() => void command("cancel")}
                    >
                      Cancel task
                    </button>
                  </div>
                </>
              )}
              {observation?.screenshot && (
                <figure className="agent-browser-preview">
                  <img
                    src={observation.screenshot}
                    alt="Current isolated browser view"
                  />
                  <figcaption>
                    Isolated browser ·{" "}
                    {observation.url.startsWith("https:")
                      ? new URL(observation.url).hostname
                      : "New session"}
                  </figcaption>
                </figure>
              )}
              {(terminal || task.state === "FAILED") && (
                <div className="agent-controls">
                  <button
                    type="button"
                    onClick={() => {
                      setTask(null);
                      setObservation(null);
                      setDraft("");
                      void resumeList();
                    }}
                  >
                    New task
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Delete this task, its permissions and execution history?",
                        )
                      )
                        return;
                      try {
                        await api("/api/tasks/" + task.id, {
                          method: "DELETE",
                        });
                        setTask(null);
                        setObservation(null);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Delete task data
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
