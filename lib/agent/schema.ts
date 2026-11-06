import { z } from "zod";
export const modes = ["guide", "do", "together"] as const;
export const states = [
  "CREATED",
  "PLANNING",
  "WAITING_FOR_PERMISSION",
  "RUNNING",
  "WAITING_FOR_USER",
  "VERIFYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export const modeSchema = z.enum(modes);
export const stateSchema = z.enum(states);
const target = z
  .object({
    role: z.enum([
      "button",
      "link",
      "textbox",
      "combobox",
      "checkbox",
      "radio",
      "tab",
      "menuitem",
    ]),
    name: z.string().trim().min(1).max(180),
  })
  .strict();
export const actionSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("navigate"), url: z.string().url().max(2000) })
    .strict(),
  z.object({ type: z.literal("click"), target }).strict(),
  z
    .object({ type: z.literal("fill"), target, value: z.string().max(500) })
    .strict(),
  z
    .object({ type: z.literal("select"), target, value: z.string().max(180) })
    .strict(),
  z
    .object({ type: z.literal("scroll"), direction: z.enum(["up", "down"]) })
    .strict(),
  z
    .object({
      type: z.literal("wait"),
      milliseconds: z.number().int().min(100).max(3000),
    })
    .strict(),
  z.object({ type: z.literal("read") }).strict(),
]);
export const assertionSchema = z
  .object({
    kind: z.enum(["text", "url"]),
    value: z.string().trim().min(3).max(300),
  })
  .strict();
export const planSchema = z
  .object({
    summary: z.string().min(1).max(500),
    domains: z
      .array(
        z
          .string()
          .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/),
      )
      .max(8),
    steps: z
      .array(
        z
          .object({
            title: z.string().min(1).max(160),
            success: z.string().min(3).max(400),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();
export const decisionSchema = z
  .object({
    explanation: z.string().min(1).max(500),
    action: actionSchema.nullable(),
    assertion: assertionSchema,
  })
  .strict();
export type Mode = z.infer<typeof modeSchema>;
export type TaskState = z.infer<typeof stateSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Step = z.infer<typeof planSchema>["steps"][number] & {
  status: "pending" | "completed";
  evidence?: string;
  source?: "user" | "browser" | "screen";
};
export type Task = {
  id: string;
  user_id: string;
  session_id: string;
  objective: string;
  mode: Mode;
  state: TaskState;
  summary: string;
  plan: Step[];
  domains: string[];
  step_index: number;
  version: number;
  pending_action: (Decision & { observationHash?: string }) | null;
  execution_id: string | null;
  observation_hash?: string | null;
  attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};
export type Observation = {
  url: string;
  text: string;
  targets: { role: string; name: string }[];
  screenshot?: string;
};
export const observationSchema = z.object({
  url: z.string().max(2000),
  text: z.string().max(10000),
  targets: z
    .array(z.object({ role: z.string().max(30), name: z.string().max(180) }))
    .max(100),
  screenshot: z.string().max(1000000).optional(),
});
