import { identity } from "@/lib/auth/server";
import { sameOrigin, failure } from "@/lib/security";
import { openai } from "@/lib/ai/provider";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { client } = await identity();
    const { error } = await client.rpc("reserve_usage", {
      p_session: null,
      p_kind: "audio",
    });
    if (error) throw new Error("Monthly or request rate limit reached");
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      if (Number(req.headers.get("content-length")) > 5000000)
        throw new Error("Audio too large");
      const form = await req.formData();
      const file = form.get("audio");
      if (
        !(file instanceof File) ||
        file.size > 5000000 ||
        !["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"].includes(
          file.type.split(";")[0],
        )
      )
        throw new Error("Unsupported audio");
      const result = await openai().audio.transcriptions.create({
        file,
        model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      });
      return Response.json({ text: result.text });
    }
    const { text } = await req.json();
    if (typeof text !== "string" || text.length > 4000)
      throw new Error("Invalid speech");
    const audio = await openai().audio.speech.create({
      model: process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts",
      voice: "coral",
      input: text,
    });
    return new Response(await audio.arrayBuffer(), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
