"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Note } from "@/lib/store";

const GAP = 22;
const WIDE = "(min-width: 1120px)";

type Place = { top: number; path: string };

type Props = {
  root: React.RefObject<HTMLDivElement | null>;
  notes: Note[];
  /** Changes whenever the page might have reflowed. */
  layoutKey: unknown;
  active: string;
  replying: string;
  onActive: (id: string) => void;
  onReply: (note: Note, text: string) => void;
  onResolve: (id: string) => void;
};

export default function Margin({ root, notes, layoutKey, active, replying, onActive, onReply, onResolve }: Props) {
  const rail = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [places, setPlaces] = useState<Record<string, Place>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [wide, setWide] = useState(false);

  const measure = useCallback(() => {
    const host = root.current;
    const side = rail.current;
    if (!host || !side) return;
    const isWide = window.matchMedia(WIDE).matches;
    setWide(isWide);
    const base = host.getBoundingClientRect();
    const left = side.getBoundingClientRect().left - base.left;

    const found: { id: string; top: number; start?: { x: number; y: number } }[] = [];
    const gone: string[] = [];
    for (const note of notes) {
      const spans = [...host.querySelectorAll(`[data-note-anchor="${note.id}"]`)];
      spans.forEach((el) => el.classList.toggle("is-active", note.id === active));
      if (!note.anchored) {
        found.push({ id: note.id, top: 0 });
      } else if (spans.length) {
        const rects = spans.at(-1)!.getClientRects();
        const end = rects[rects.length - 1];
        found.push({
          id: note.id,
          top: spans[0].getBoundingClientRect().top - base.top - 2,
          start: { x: end.right - base.left + 3, y: end.bottom - base.top - 5 },
        });
      } else {
        gone.push(note.id); // Their passage was deleted; undo brings the comment back.
      }
    }
    found.sort((a, b) => a.top - b.top);

    const next: Record<string, Place> = {};
    let floor = 0;
    for (const item of found) {
      const top = Math.max(item.top, floor);
      floor = top + (cards.current.get(item.id)?.offsetHeight ?? 0) + GAP;
      let path = "";
      if (item.start) {
        const { x, y } = item.start;
        const endX = left - 12;
        const endY = top + 13;
        const pull = Math.max(36, (endX - x) * 0.55);
        path = `M${x} ${y} C${x + pull} ${y + 6} ${endX - pull} ${endY} ${endX} ${endY}`;
      }
      next[item.id] = { top, path };
    }
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

  return (
    <>
      {wide && (
        <svg className="tinkr-threads" aria-hidden>
          <defs>
            <filter id="tinkr-pencil">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="4" />
              <feDisplacementMap in="SourceGraphic" scale="2.2" />
            </filter>
          </defs>
          {shown.map((note) =>
            places[note.id]?.path ? (
              <path
                key={note.id}
                d={places[note.id].path}
                pathLength={1}
                filter="url(#tinkr-pencil)"
                className={note.id === active ? "is-active" : ""}
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
            className={`tinkr-note ${note.id === active ? "is-active" : ""}`}
            style={wide ? { top: places[note.id]?.top ?? 0 } : undefined}
            onClick={() => onActive(note.id)}
          >
            {note.turns.map((turn, i) =>
              turn.role === "partner" ? (
                <p key={i} className="tinkr-voice">{turn.text || "…"}</p>
              ) : (
                <p key={i} className="tinkr-reply">{turn.text}</p>
              ),
            )}
            {note.id === active && (
              <Reply busy={replying === note.id} onSend={(text) => onReply(note, text)} onResolve={() => onResolve(note.id)} />
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function Reply({ busy, onSend, onResolve }: { busy: boolean; onSend: (text: string) => void; onResolve: () => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="mt-2">
      <textarea
        className="tinkr-ask is-small"
        rows={1}
        value={draft}
        placeholder="Reply…"
        aria-label="Reply to this comment"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const text = draft.trim();
            if (!text || busy) return;
            setDraft("");
            onSend(text);
          }
        }}
      />
      <button type="button" className="tinkr-quiet mt-2 !text-[13px]" onClick={onResolve}>
        Resolve
      </button>
    </div>
  );
}
