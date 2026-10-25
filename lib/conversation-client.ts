import { errorMessage } from "@/lib/errors";
export type ConversationProblem = Error & {
  code?: string;
  questionSaved?: boolean;
  turnId?: string;
};
export function problem(
  data: {
    error?: string;
    code?: string;
    questionSaved?: boolean;
    turnId?: string;
  },
  locale: string,
): ConversationProblem {
  return Object.assign(
    new Error(
      errorMessage(data.code, data.error || "Connection interrupted.", locale),
    ),
    { code: data.code, questionSaved: data.questionSaved, turnId: data.turnId },
  );
}
export async function request(
  url: string,
  init: RequestInit,
  locale: string,
  signal: AbortSignal,
  timeout = 50000,
) {
  const controller = new AbortController();
  const stop = () => controller.abort(signal.reason);
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (
      response.ok &&
      response.headers.get("content-type")?.includes("text/html")
    )
      throw problem(
        { code: "UNAUTHORIZED", error: "Please sign in again." },
        locale,
      );
    if (!response.ok) {
      let data;
      try {
        data = await response.json();
      } catch {}
      throw problem(data || { code: "CONNECTION_LOST" }, locale);
    }
    return response;
  } catch (e) {
    if (timedOut)
      throw problem(
        { code: "RESPONSE_TIMEOUT", error: "The request timed out." },
        locale,
      );
    throw e;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
}
export async function readConversation(
  response: Response,
  onEvent: (event: any) => void,
  signal: AbortSignal,
  locale: string,
) {
  const reader = response.body?.getReader();
  if (!reader) throw problem({ code: "CONNECTION_LOST" }, locale);
  const decoder = new TextDecoder();
  let buffer = "",
    done = false;
  const abort = () => {
    void reader.cancel();
  };
  if (signal.aborted) {
    await reader.cancel();
    throw new DOMException("Aborted", "AbortError");
  }
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const chunk = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(problem({ code: "RESPONSE_TIMEOUT" }, locale));
            void reader.cancel();
          }, 45000);
        }),
      ]).finally(() => clearTimeout(timer));
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.error) throw problem(event, locale);
        onEvent(event);
        if (event.done) done = true;
      }
    }
    if (buffer.trim()) {
      const event = JSON.parse(buffer);
      if (event.error) throw problem(event, locale);
      onEvent(event);
      done = event.done === true;
    }
    if (!done) throw problem({ code: "CONNECTION_LOST" }, locale);
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
