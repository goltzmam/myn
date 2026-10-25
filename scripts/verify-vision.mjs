// Optional paid provider smoke check. Run manually; never included in CI.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { chromium } from "@playwright/test";
import { guidanceSchema, policy } from "../lib/guide.ts";
if (!process.env.MYN_AI_KEY && !process.env.OPENAI_API_KEY)
  throw new Error("Configure MYN_AI_KEY");
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 960 },
  });
  await page.goto(
    (process.env.MYN_TEST_ORIGIN || "http://127.0.0.1:3000") + "/try/guide",
  );
  await page
    .getByRole("button", { name: "Compartilhar tela", exact: true })
    .waitFor();
  const image = await page.screenshot({ type: "jpeg", quality: 65 });
  const result = await new OpenAI({
    apiKey: process.env.MYN_AI_KEY || process.env.OPENAI_API_KEY,
    timeout: 45000,
    maxRetries: 0,
  }).responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
    store: false,
    max_output_tokens: 600,
    input: [
      { role: "system", content: policy },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Responda em português. Quero iniciar o teste de tela no MYN. Identifique o texto exato do botão visível que devo clicar. A tela ainda não foi compartilhada; não confirme passos concluídos.",
          },
          {
            type: "input_image",
            image_url: "data:image/jpeg;base64," + image.toString("base64"),
            detail: "high",
          },
        ],
      },
    ],
    text: { format: zodTextFormat(guidanceSchema, "guidance") },
  });
  const guidance = guidanceSchema.parse(result.output_parsed);
  if (!JSON.stringify(guidance).includes("Compartilhar tela"))
    throw new Error("Expected visible share button was not identified");
  console.log(
    "PASS: live OpenAI visual response identified the actual Compartilhar tela button and returned validated structured guidance.",
  );
} catch (e) {
  console.error(
    "Vision check failed:",
    JSON.stringify({
      status: e.status || null,
      code: e.code || null,
      type: e.type || null,
      name: e.name,
    }),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
