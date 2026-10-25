import { it, expect } from "vitest";
import { readConversation } from "../lib/conversation-client";
import { nextSpeechChunk } from "../lib/audio/sentences";
it("decodes fragmented multilingual streaming events and accepts a final line without a newline", async () => {
  const encoder = new TextEncoder(),
    data = encoder.encode(
      JSON.stringify({ delta: "こんにちは、Olá" }) +
        "\n" +
        JSON.stringify({ done: true, saved: true }),
    );
  const r = new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < data.length; i += 3)
          c.enqueue(data.slice(i, i + 3));
        c.close();
      },
    }),
  );
  const events: any[] = [];
  await readConversation(
    r,
    (e) => events.push(e),
    new AbortController().signal,
    "en",
  );
  expect(events).toEqual([
    { delta: "こんにちは、Olá" },
    { done: true, saved: true },
  ]);
});
it("fails visibly if the stream closes without a completion acknowledgement", async () => {
  await expect(
    readConversation(
      new Response('{"delta":"hello"}\n'),
      () => {},
      new AbortController().signal,
      "en",
    ),
  ).rejects.toMatchObject({ code: "CONNECTION_LOST" });
});
it("preserves all words when splitting long speech and avoids tiny final requests", () => {
  let rest = "Uma frase longa para testar a continuidade da resposta. ".repeat(
      50,
    ),
    combined = "";
  while (rest) {
    const chunk = nextSpeechChunk(rest, true);
    expect(chunk.length).toBeGreaterThan(0);
    expect(chunk.length).toBeLessThanOrEqual(900);
    combined += chunk;
    rest = rest.slice(chunk.length);
  }
  expect(combined).toBe(
    "Uma frase longa para testar a continuidade da resposta. ".repeat(50),
  );
  expect(nextSpeechChunk("Uma resposta curta.", false)).toBe("");
  expect(nextSpeechChunk("Uma resposta curta.", true)).toBe(
    "Uma resposta curta.",
  );
});
