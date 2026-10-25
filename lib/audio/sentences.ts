// Sentence-size speech chunks let the first audio start before a long reply finishes.
export function nextSpeechChunk(text: string, final = false): string {
  if (!text.trim()) return "";
  if (!final && text.length < 80) return "";
  if (final && text.length <= 900) return text;
  const max = final ? 900 : 450;
  const part = text.slice(0, max);
  let boundary = 0;
  for (const match of part.matchAll(/[.!?。！？](?:\s|$)/gu)) {
    const end = match.index! + match[0].length;
    if (end >= 40) {
      boundary = end;
      break;
    }
  }
  if (boundary) return text.slice(0, boundary);
  if (!final && text.length < max) return "";
  if (text.length <= max) return final ? text : "";
  const space = part.lastIndexOf(" ");
  return text.slice(0, space > max / 2 ? space + 1 : max);
}
