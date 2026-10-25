import "server-only";
import OpenAI from "openai";
import { AppError } from "@/lib/errors";
import { zodTextFormat } from "openai/helpers/zod";
import { guidanceSchema, policy, type Guidance } from "@/lib/guide";
export interface AIProvider {
  analyze(
    input: {
      message: string;
      image?: string;
      history: { role: string; content: string }[];
      language: string;
      agent?: string;
      mode: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ guidance: Guidance; tokens: number }>;
}
export function openai() {
  const key =
    process.env.MYN_AI_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  if (!key)
    throw new AppError(
      "AI_NOT_CONFIGURED",
      503,
      "Conversation is not connected in this deployment. Configure MYN_AI_KEY in the server environment and redeploy.",
    );
  return new OpenAI({
    apiKey: key,
    timeout: 35000,
    maxRetries: 0,
  });
}
export const provider: AIProvider = {
  async analyze({ message, image, history, language, agent, mode }, options) {
    const result = await openai().responses.parse(
      {
        model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
        store: false,
        max_output_tokens: 1800,
        input: [
          { role: "system", content: policy },
          {
            role: "user",
            content: JSON.stringify({ language, mode, agent, history }),
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: message },
              ...(image
                ? [
                    {
                      type: "input_image" as const,
                      image_url: image,
                      detail: "high" as const,
                    },
                  ]
                : []),
            ],
          },
        ],
        text: { format: zodTextFormat(guidanceSchema, "guidance") },
      },
      { signal: options?.signal },
    );
    if (!result.output_parsed)
      throw new Error("AI could not produce guidance.");
    return {
      guidance: result.output_parsed,
      tokens: result.usage?.total_tokens || 0,
    };
  },
};
