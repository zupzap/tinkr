import type { EditorState, Transaction } from "@tiptap/pm/state";

export const ANCHOR = "noteAnchor";

type Range = { from: number; to: number };

function lastSentence(text: string) {
  const end = text.trimEnd().length;
  const breaks = [...text.slice(0, end).matchAll(/[.!?]\s+/g)];
  const last = breaks.at(-1);
  return { start: last ? last.index + last[0].length : 0, end };
}

/**
 * Finds what a comment is about: the selection, else the passage the model
 * quoted, else the last sentence the writer finished near their cursor.
 */
export function findRange(state: EditorState, quote = ""): Range | null {
  const { selection, doc } = state;
  if (!selection.empty) return { from: selection.from, to: selection.to };

  const blocks: { text: string; start: number }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, undefined, " ");
    if (text.trim()) blocks.push({ text, start: pos + 1 });
    return false;
  });
  if (!blocks.length) return null;

  const wanted = quote.trim();
  if (wanted) {
    for (const { text, start } of [...blocks].reverse()) {
      const at = text.lastIndexOf(wanted);
      if (at >= 0) return { from: start + at, to: start + at + wanted.length };
    }
  }

  const near = [...blocks].reverse().find((b) => b.start <= selection.from) ?? blocks[0];
  const sentence = lastSentence(near.text);
  return { from: near.start + sentence.start, to: near.start + sentence.end };
}

/** Underlines a passage for a comment. The writer's cursor and undo history are untouched. */
export function addAnchor(state: EditorState, id: string, range: Range): Transaction {
  return state.tr
    .addMark(range.from, range.to, state.schema.marks[ANCHOR].create({ id }))
    .setMeta("tinkr", true)
    .setMeta("addToHistory", false);
}
