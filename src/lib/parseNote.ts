export type ParsedNote = { text: string; quote: string; replyNumber?: number };

function fromJson(json: string): ParsedNote | null {
  const out = JSON.parse(json) as { note?: string | null; quote?: string; replyTo?: number };
  if (!out.note?.trim()) return null;
  return { text: out.note.trim(), quote: out.quote?.trim() ?? "", replyNumber: out.replyTo };
}

/** Rescues the comment from JSON that was cut off or malformed. */
function fromBrokenJson(raw: string): ParsedNote | null {
  const note = raw.match(/"note"\s*:\s*"((?:[^"\\]|\\.)*)/)?.[1];
  if (!note) return null;
  const quote = raw.match(/"quote"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? "";
  const clean = (s: string) => s.replace(/\\(["\\/])/g, "$1").replace(/\\n/g, "\n").trim();
  return { text: clean(note), quote: clean(quote) };
}

/**
 * The model is asked for JSON, but longer comments often arrive as plain text,
 * sometimes with the quoted passage on the first line. Those are still good comments.
 */
export function parseNote(raw: string): ParsedNote | null {
  const text = raw.trim();
  if (!text || text === "null") return null;

  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (json) {
    try {
      return fromJson(json);
    } catch {
      return fromBrokenJson(text);
    }
  }
  if (text.startsWith("{")) return fromBrokenJson(text);

  const [first, ...rest] = text.split(/\n\s*\n/);
  if (rest.length && /^"[^"\n]+"$/.test(first.trim())) {
    return { text: rest.join("\n\n").trim(), quote: first.trim().slice(1, -1) };
  }
  return { text: text.replace(/^"([\s\S]*)"$/, "$1").trim(), quote: "" };
}
