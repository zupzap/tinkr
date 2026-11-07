"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { placeNotes, type Side } from "@/lib/layout";
import type { Note } from "@/lib/store";

const GAP = 22;
const RAIL_WIDTH = 260;
const RAIL_GAP = 48; // between the writing and a comment; globals.css leaves room for both
const WIDE = "(min-width: 1120px)"; // room for comments on the right
const VERY_WIDE = "(min-width: 1340px)"; // room on both sides

type Place = { top: number; left: number; side: Side; path: string };

type Props = {
  root: React.RefObject<HTMLDivElement | null>;
  notes: Note[];
  /** Changes whenever the page might have reflowed. */
  layoutKey: unknown;
  active: string;
  onActive: (id: string) => void;
};

export default function Margin({ root, notes, layoutKey, active, onActive }: Props) {
  const rail = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [places, setPlaces] = useState<Record<string, Place>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [wide, setWide] = useState(false);

  const measure = useCallback(() => {
    const host = root.current;
    const side = rail.current;
    if (!host || !side) return;
    const page = host.querySelector("main");
    if (!page) return;
    setWide(window.matchMedia(WIDE).matches);
    const sides: Side[] = window.matchMedia(VERY_WIDE).matches ? ["right", "left"] : ["right"];
    const base = host.getBoundingClientRect();
    const column = page.getBoundingClientRect();
    const columnLeft = column.left - base.left;
    const columnRight = column.right - base.left;

    const found: { id: string; top: number; line?: { left: number; right: number; y: number } }[] = [];
    const gone: string[] = [];
    const block = document.createRange();
    for (const note of notes) {
      const spans = [...host.querySelectorAll(`[data-note-anchor="${CSS.escape(note.id)}"]`)];
      spans.forEach((el) => el.classList.toggle("is-active", note.id === active));
      if (!note.anchored) {
        found.push({ id: note.id, top: 0 });
      } else if (spans.length) {
        const line = spans[0].getClientRects()[0];
        // Find where this line's text starts and ends, so threads only cross empty space.
        block.selectNodeContents(spans[0].closest("p, li, h1, h2, h3, blockquote") ?? spans[0]);
        const middle = line.top + line.height / 2;
        const rects = [...block.getClientRects()].filter((r) => r.top <= middle && r.bottom >= middle);
        found.push({
          id: note.id,
          top: line.top - base.top - 2,
          line: {
            left: Math.min(line.left, ...rects.map((r) => r.left)) - base.left - 6,
            right: Math.max(line.right, ...rects.map((r) => r.right)) - base.left + 6,
            y: line.bottom - base.top - 4,
          },
        });
      } else {
        gone.push(note.id); // Their passage was deleted; undo brings the comment back.
      }
    }
    found.sort((a, b) => a.top - b.top);

    const slots = found.map(({ id, top }) => ({ id, top, height: cards.current.get(id)?.offsetHeight ?? 0 }));
    const next: Record<string, Place> = {};
    placeNotes(slots, sides, GAP).forEach(({ id, top, side }, i) => {
      const onRight = side === "right";
      const left = onRight ? columnRight + RAIL_GAP : columnLeft - RAIL_GAP - RAIL_WIDTH;
      let path = "";
      const line = found[i].line;
      if (line) {
        const x = onRight ? line.right : line.left;
        const edge = onRight ? columnRight + 8 : columnLeft - 8;
        const endX = onRight ? columnRight + RAIL_GAP - 10 : columnLeft - RAIL_GAP + 10;
        const endY = top + 13;
        const bend = (endX - edge) / 2;
        // Along the empty end of the line, then any drop happens in the gutter.
        path = `M${x} ${line.y} L${edge} ${line.y} C${edge + bend} ${line.y} ${endX - bend} ${endY} ${endX} ${endY}`;
      }
      next[id] = { top, left, side, path };
    });
    setPlaces((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    setHidden((old) => (old.join() === gone.join() ? old : gone));
  }, [root, notes, active]);

  useLayoutEffect(measure, [measure, layoutKey]);

  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root.current);
    cards.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [root, measure]);

  const shown = notes.filter((n) => !hidden.includes(n.id));
  const parent = (note: Note) => shown.find((n) => n.id === note.replyTo)?.turns[0]?.text;

  return (
    <>
      {wide && (
        <svg className="tinkr-threads" aria-hidden>
          {shown.map((note) =>
            places[note.id]?.path ? (
              <path
                key={note.id}
                className={`tinkr-thread ${note.id === active ? "is-active" : ""}`}
                d={places[note.id].path}
                pathLength={1}
              />
            ) : null,
          )}
        </svg>
      )}
      <div ref={rail} className="tinkr-rail" aria-label="Comments">
        {shown.map((note) => (
          <article
            key={note.id}
            ref={(el) => {
              if (el) cards.current.set(note.id, el);
              else cards.current.delete(note.id);
            }}
            className={`tinkr-note ${note.id === active ? "is-active" : ""} ${
              wide && places[note.id]?.side === "left" ? "is-left" : ""
            }`}
            style={
              wide
                ? { top: places[note.id]?.top ?? 0, left: places[note.id]?.left ?? 0, width: RAIL_WIDTH }
                : undefined
            }
            onClick={() => onActive(note.id)}
          >
            {parent(note) && (
              <button
                type="button"
                className="tinkr-re"
                onClick={(e) => {
                  e.stopPropagation();
                  onActive(note.replyTo!);
                  cards.current.get(note.replyTo!)?.scrollIntoView({ block: "center", behavior: "smooth" });
                }}
              >
                re: {parent(note)}
              </button>
            )}
            {note.turns.map((turn, i) =>
              turn.role === "partner" ? (
                <p key={i} className="tinkr-voice whitespace-pre-wrap">{turn.text || "…"}</p>
              ) : (
                <p key={i} className="tinkr-reply">{turn.text}</p>
              ),
            )}
          </article>
        ))}
      </div>
    </>
  );
}
