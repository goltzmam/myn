import { z } from "zod";
import { identity } from "@/lib/auth/server";
import { sameOrigin, failure } from "@/lib/security";
import { openai } from "@/lib/ai/provider";
import { conversationLanguageSchema } from "@/lib/guide";
import { activeSession, reserve } from "@/lib/sessions/server";
import { AppError } from "@/lib/errors";
export const maxDuration = 60;
const speechSchema = z.object({
  sessionId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
  language: conversationLanguageSchema.default("auto"),
});
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { client, user } = await identity();
    if (Number(req.headers.get("content-length")) > 4200000)
      throw new AppError(
        "INVALID_REQUEST",
        413,
        "Recording is too large. Record a shorter question.",
      );
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const sessionId = z.string().uuid().parse(form.get("sessionId"));
      const language = conversationLanguageSchema.parse(
        form.get("language") || "auto",
      );
      const file = form.get("audio");
      if (
        !(file instanceof File) ||
        file.size === 0 ||
        file.size > 4000000 ||
        ![
          "audio/webm",
          "audio/mp4",
          "audio/ogg",
          "audio/wav",
          "audio/mpeg",
        ].includes(file.type.split(";")[0])
      )
        throw new AppError(
          "INVALID_REQUEST",
          400,
          "Unsupported or empty recording.",
        );
      await activeSession(client, user.id, sessionId);
      await reserve(client, sessionId, "audio");
      const result = await openai().audio.transcriptions.create(
        {
          file,
          model:
            process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",

          prompt:
            "Transcribe faithfully in the original spoken language and script. Do not translate.",
        },
        { signal: req.signal },
      );
      if (!result.text.trim())
        throw new AppError(
          "TRANSCRIPTION_EMPTY",
          422,
          "No speech was detected.",
        );
      return Response.json(
        { text: result.text },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const body = speechSchema.parse(await req.json());
    await activeSession(client, user.id, body.sessionId);
    await reserve(client, body.sessionId, "audio");
    const audio = await openai().audio.speech.create(
      {
        model: process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts",
        voice: "coral",
        input: body.text,
        instructions:
          "You are a warm, clear mentor. Speak naturally in the language of the supplied text, preserving its pronunciation and script. Do not translate. Use a calm conversational pace.",
      },
      { signal: req.signal },
    );
    return new Response(await audio.arrayBuffer(), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
