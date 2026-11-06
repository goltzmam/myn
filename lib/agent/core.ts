import { AppError } from "@/lib/errors";
import type { Action, Mode, Observation, Step, TaskState } from "./schema";
export const transitions: Record<TaskState, TaskState[]> = {
  CREATED: ["PLANNING", "CANCELLED"],
  PLANNING: [
    "WAITING_FOR_USER",
    "WAITING_FOR_PERMISSION",
    "FAILED",
    "CANCELLED",
  ],
  WAITING_FOR_PERMISSION: [
    "RUNNING",
    "WAITING_FOR_USER",
    "CANCELLED",
    "FAILED",
  ],
  RUNNING: [
    "WAITING_FOR_PERMISSION",
    "WAITING_FOR_USER",
    "VERIFYING",
    "FAILED",
    "CANCELLED",
  ],
  WAITING_FOR_USER: [
    "PLANNING",
    "WAITING_FOR_PERMISSION",
    "RUNNING",
    "VERIFYING",
    "CANCELLED",
  ],
  VERIFYING: [
    "RUNNING",
    "WAITING_FOR_USER",
    "WAITING_FOR_PERMISSION",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
  ],
  COMPLETED: [],
  FAILED: [
    "PLANNING",
    "WAITING_FOR_USER",
    "WAITING_FOR_PERMISSION",
    "CANCELLED",
  ],
  CANCELLED: [],
};
export function assertTransition(from: TaskState, to: TaskState) {
  if (from !== to && !transitions[from].includes(to))
    throw new AppError(
      "TASK_CONFLICT",
      409,
      "This task changed. Refresh before continuing.",
    );
}
export function needsApproval(action: Action) {
  return ["navigate", "click", "fill", "select"].includes(action.type);
}
export function verifyObservation(
  observation: Observation,
  assertion: { kind: "text" | "url"; value: string },
): string | null {
  if (assertion.kind === "url") {
    try {
      const expected = new URL(assertion.value),
        current = new URL(observation.url);
      if (
        expected.origin === current.origin &&
        current.pathname === expected.pathname &&
        (!expected.search || expected.search === current.search)
      )
        return "Browser URL matched " + expected.origin + expected.pathname;
    } catch {}
    return null;
  }
  return observation.text
    .toLocaleLowerCase()
    .includes(assertion.value.toLocaleLowerCase())
    ? "Observed page text: " + assertion.value
    : null;
}
export function completeStep(
  plan: Step[],
  index: number,
  evidence: string,
  source: Step["source"],
) {
  if (!plan[index] || evidence.trim().length < 3)
    throw new AppError(
      "VERIFICATION_REQUIRED",
      409,
      "Evidence is required before completing a step.",
    );
  return plan.map((s, i) =>
    i === index ? { ...s, status: "completed" as const, evidence, source } : s,
  );
}
export function canComplete(plan: Step[]) {
  return (
    plan.length > 0 &&
    plan.every((s) => s.status === "completed" && !!s.evidence?.trim())
  );
}
export function modeState(mode: Mode): TaskState {
  return mode === "guide" ? "WAITING_FOR_USER" : "WAITING_FOR_PERMISSION";
}
export function safeTaskError(error: unknown) {
  return error instanceof AppError
    ? error.message
    : "The action could not be verified. Review the page, then retry or continue with guidance.";
}
