"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Chat from "./Chat";
import Editor, { type Change, type EditorHandle } from "./Editor";
import Margin from "./Margin";
import { load, newDoc, save, STARTERS, uid, type Doc, type Lens, type Move, type Note, type Starter } from "@/lib/store";

const PAUSE_MS = 1800; // a pause mid-thought
const URGENT_PAUSE_MS = 800; // just finished a paragraph or asked a question
const MIN_GAP_MS = 9000; // least time between comments, unless it's a natural moment
const MIN_NEW_CHARS = 30;
const MIN_URGENT_CHARS = 4;
const MIN_TEXT = 12;

const TAKE_STOCK =
  "Take stock of this page. In short plain lines under the labels Decided, Assumed, Open and Next, list what is settled, what is assumed without evidence, what is unresolved, and the single next thing to find out. Use only what is on the page.";

const LENSES: { value: Lens; label: string; hint: string }[] = [
  { value: "open", label: "Open", hint: "Any kind of thinking" },
  { value: "product", label: "Product", hint: "Users, evidence, metrics, smallest test" },
];

type Panel = "pages" | "chat" | "mode" | "lens" | null;

async function streamReply(body: object, onText: (text: string) => void) {
  const res = await fetch("/api/partner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "ask", ...body }),
  });
  if (!res.ok || !res.body) throw new Error((await res.json()).error);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += value;
    onText(text);
  }
  if (!text) throw new Error("No answer came back. Try again.");
}

const message = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "Couldn't reach your partner.";

export default function Tinkr() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [activeId, setActiveId] = useState("");
  const [quiet, setQuiet] = useState(false);
  const [reading, setReading] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [replying, setReplying] = useState("");
  const [activeNote, setActiveNote] = useState("");
  const [error, setError] = useState("");
  const [chatError, setChatError] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);

  const editor = useRef<EditorHandle>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const chatInput = useRef<HTMLTextAreaElement>(null);
  const pause = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastRead = useRef(new Map<string, { len: number; at: number }>());
  const live = useRef({ docs, activeId, quiet, reading });
  live.current = { docs, activeId, quiet, reading };

  useEffect(() => {
    const saved = load();
    setDocs(saved.docs);
    setActiveId(saved.activeId);
    setQuiet(saved.quiet);
  }, []);

  useEffect(() => {
    if (!docs) return;
    const write = () => setSaveFailed(!save({ docs, activeId, quiet }));
    const timer = setTimeout(write, 300);
    window.addEventListener("pagehide", write);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", write);
    };
  }, [docs, activeId, quiet]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel(null);
        setActiveNote("");
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setPanel("chat");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (panel === "chat") chatInput.current?.focus();
  }, [panel]);

  useEffect(() => () => clearTimeout(pause.current), []);

  const patch = useCallback((id: string, change: (doc: Doc) => Partial<Doc>) => {
    setDocs((all) => all?.map((d) => (d.id === id ? { ...d, ...change(d) } : d)) ?? null);
  }, []);

  const requestNote = useCallback(
    async (move: Move, selection = "") => {
      const { docs, activeId, reading } = live.current;
      const doc = docs?.find((d) => d.id === activeId);
      if (!doc || reading) return;
      const seen = doc.text.length;
      setReading(true);
      setError("");
      try {
        const res = await fetch("/api/partner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "note",
            move,
            lens: doc.lens,
            title: doc.title,
            text: doc.text,
            selection,
            focus: editor.current?.context().focus ?? "",
            recent: doc.notes.map((n) => n.turns[0]?.text ?? ""),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!data.note) {
          if (move !== "auto") setError("Nothing to add on that one.");
        } else if (live.current.activeId === doc.id) {
          // If they moved to another page meanwhile, the passage is no longer on screen to anchor.
          const id = uid();
          const quote = selection.split("\n")[0] || data.note.quote;
          const anchored = editor.current?.anchor(id, quote) ?? false;
          const note: Note = {
            id,
            quote,
            anchored,
            turns: [{ role: "partner", text: data.note.text }],
            at: Date.now(),
          };
          patch(doc.id, (d) => ({ notes: [...d.notes, note] }));
          if (move !== "auto") setActiveNote(id);
        }
      } catch (err) {
        setError(message(err));
      } finally {
        lastRead.current.set(doc.id, { len: seen, at: Date.now() });
        setReading(false);
      }
    },
    [patch],
  );

  const readAlong = useCallback(
    function check() {
      const { docs, activeId, quiet, reading } = live.current;
      const doc = docs?.find((d) => d.id === activeId);
      if (!doc || quiet || doc.text.trim().length < MIN_TEXT) return;
      const urgent = editor.current?.context().urgent ?? false;
      const last = lastRead.current.get(doc.id);
      const fresh = last ? Math.abs(doc.text.length - last.len) : Infinity;
      if (fresh < (urgent ? MIN_URGENT_CHARS : MIN_NEW_CHARS)) return;
      const wait = last && !urgent ? MIN_GAP_MS - (Date.now() - last.at) : 0;
      if (wait > 0 || reading) {
        clearTimeout(pause.current);
        pause.current = setTimeout(check, Math.max(wait, 700));
        return;
      }
      void requestNote("auto");
    },
    [requestNote],
  );

  const onChange = useCallback(
    ({ content, text, typed }: Change) => {
      patch(live.current.activeId, () => ({ content, text, updatedAt: Date.now() }));
      if (!typed) return;
      setActiveNote("");
      clearTimeout(pause.current);
      const urgent = editor.current?.context().urgent;
      pause.current = setTimeout(readAlong, urgent ? URGENT_PAUSE_MS : PAUSE_MS);
    },
    [patch, readAlong],
  );

  const ask = async (text: string, shown = text) => {
    const { docs, activeId } = live.current;
    const doc = docs?.find((d) => d.id === activeId);
    if (!doc) return;
    const history = doc.feed
      .filter((i) => i.text)
      .map((i) => ({ role: i.role === "you" ? "user" : "assistant", content: i.text }));
    const reply = uid();
    const at = Date.now();
    patch(doc.id, (d) => ({
      feed: [...d.feed, { id: uid(), role: "you", text: shown, at }, { id: reply, role: "partner", text: "", at }],
    }));
    setChatting(true);
    setChatError("");
    let got = false;
    try {
      await streamReply(
        { message: text, history, lens: doc.lens, title: doc.title, text: doc.text },
        (answer) => {
          got = true;
          patch(doc.id, (d) => ({ feed: d.feed.map((i) => (i.id === reply ? { ...i, text: answer } : i)) }));
        },
      );
    } catch (err) {
      if (!got) patch(doc.id, (d) => ({ feed: d.feed.filter((i) => i.id !== reply) }));
      setChatError(message(err));
    } finally {
      setChatting(false);
    }
  };

  const replyTo = async (note: Note, text: string) => {
    const { docs, activeId } = live.current;
    const doc = docs?.find((d) => d.id === activeId);
    if (!doc) return;
    const setTurns = (change: (turns: Note["turns"]) => Note["turns"]) =>
      patch(doc.id, (d) => ({
        notes: d.notes.map((n) => (n.id === note.id ? { ...n, turns: change(n.turns) } : n)),
      }));
    const history = note.turns.map((t) => ({ role: t.role === "you" ? "user" : "assistant", content: t.text }));
    setTurns((t) => [...t, { role: "you", text }, { role: "partner", text: "" }]);
    setReplying(note.id);
    setError("");
    let got = false;
    try {
      await streamReply(
        { message: text, history, quote: note.quote, lens: doc.lens, title: doc.title, text: doc.text },
        (answer) => {
          got = true;
          setTurns((t) => [...t.slice(0, -1), { role: "partner", text: answer }]);
        },
      );
    } catch (err) {
      if (!got) setTurns((t) => t.slice(0, -1));
      setError(message(err));
    } finally {
      setReplying("");
    }
  };

  const resolve = (id: string) => {
    editor.current?.unanchor(id);
    patch(live.current.activeId, (d) => ({ notes: d.notes.filter((n) => n.id !== id) }));
    setActiveNote("");
  };

  const open = (id: string) => {
    clearTimeout(pause.current);
    setActiveId(id);
    setActiveNote("");
    setError("");
    setChatError("");
    setPanel(null);
    setConfirmDelete("");
  };

  const create = (starter: Starter) => {
    const doc = newDoc(starter);
    setDocs((all) => [doc, ...(all ?? [])]);
    open(doc.id);
  };

  const remove = (id: string) => {
    const rest = (docs ?? []).filter((d) => d.id !== id);
    const next = rest.length ? rest : [newDoc()];
    setDocs(next);
    if (id === activeId) open(next[0].id);
    setConfirmDelete("");
  };

  if (!docs) return <div className="h-dvh bg-paper" />;

  const doc = docs.find((d) => d.id === activeId) ?? docs[0];
  const sorted = [...docs].sort((a, b) => b.updatedAt - a.updatedAt);
  const lens = LENSES.find((l) => l.value === doc.lens) ?? LENSES[0];

  return (
    <div className="h-dvh overflow-y-auto">
      <header className="tinkr-top">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="tinkr-menu"
            aria-label="Pages"
            aria-expanded={panel === "pages"}
            onClick={() => setPanel(panel === "pages" ? null : "pages")}
          >
            <span />
            <span />
          </button>
          <span className="tinkr-wordmark">
            <span className={`tinkr-mark ${reading ? "is-reading" : ""}`} aria-hidden />
            tinkr.
          </span>
        </div>
        <button type="button" className="tinkr-pill" onClick={() => setPanel(panel === "chat" ? null : "chat")}>
          <span className="tinkr-mark" aria-hidden />
          Chat
        </button>
      </header>

      <div
        ref={sheet}
        className="tinkr-sheet"
        onClick={(e) => {
          const hit = (e.target as HTMLElement).closest("[data-note-anchor]");
          if (hit) setActiveNote(hit.getAttribute("data-note-anchor") ?? "");
        }}
      >
        <main className="min-w-0 pb-[45vh] pt-6">
          <div className="tinkr-row">
            <div className="relative">
              <button
                type="button"
                className="tinkr-quiet"
                aria-expanded={panel === "mode"}
                onClick={() => setPanel(panel === "mode" ? null : "mode")}
              >
                <span className={`tinkr-lamp ${quiet ? "is-off" : ""}`} aria-hidden />
                {quiet ? "When you ask" : "Thinks with you"}
                <span className="tinkr-caret" aria-hidden />
              </button>
              {panel === "mode" && (
                <div className="tinkr-popover">
                  {[
                    { value: false, label: "Thinks with you", hint: "Comments as you write" },
                    { value: true, label: "When you ask", hint: "Stays silent until you ask" },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      aria-pressed={quiet === option.value}
                      onClick={() => {
                        setQuiet(option.value);
                        setPanel(null);
                      }}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                className="tinkr-quiet"
                aria-expanded={panel === "lens"}
                onClick={() => setPanel(panel === "lens" ? null : "lens")}
              >
                {lens.label} lens
                <span className="tinkr-caret" aria-hidden />
              </button>
              {panel === "lens" && (
                <div className="tinkr-popover">
                  {LENSES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={doc.lens === option.value}
                      onClick={() => {
                        patch(doc.id, () => ({ lens: option.value }));
                        setPanel(null);
                      }}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="tinkr-quiet" disabled={reading} onClick={() => requestNote("stuck")}>
              I&apos;m stuck
            </button>
            <button
              type="button"
              className="tinkr-quiet"
              disabled={chatting}
              onClick={() => {
                setPanel("chat");
                void ask(TAKE_STOCK, "Take stock");
              }}
            >
              Take stock
            </button>
            <span className="tinkr-status" role="status">
              {error || (reading ? "Reading…" : "")}
            </span>
          </div>

          <textarea
            key={`title-${doc.id}`}
            className="tinkr-title"
            rows={1}
            value={doc.title}
            placeholder="Untitled"
            aria-label="Title"
            onChange={(e) => {
              const title = e.target.value.replace(/\n/g, " ");
              patch(doc.id, () => ({ title, updatedAt: Date.now() }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor.current?.focus();
              }
            }}
          />
          <Editor key={doc.id} ref={editor} content={doc.content} onChange={onChange} onMove={requestNote} />
        </main>

        <Margin
          key={`margin-${doc.id}`}
          root={sheet}
          notes={doc.notes}
          layoutKey={doc.content}
          active={activeNote}
          replying={replying}
          onActive={setActiveNote}
          onReply={replyTo}
          onResolve={resolve}
        />
      </div>

      {(panel === "pages" || panel === "mode" || panel === "lens") && (
        <button type="button" className="tinkr-scrim" aria-label="Close" onClick={() => setPanel(null)} />
      )}

      <aside className={`tinkr-drawer ${panel === "pages" ? "is-open" : ""}`} aria-label="Pages" inert={panel !== "pages"}>
        <p className="px-5 pb-2 pt-6 text-[13px] text-muted">New page</p>
        <div className="grid gap-px px-2 pb-4">
          {STARTERS.map((starter) => (
            <button key={starter.name} type="button" className="tinkr-starter" onClick={() => create(starter)}>
              <strong>{starter.name}</strong>
              <small>{starter.hint}</small>
            </button>
          ))}
        </div>
        <p className="px-5 pb-2 text-[13px] text-muted">Pages</p>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {sorted.map((d) => (
            <div key={d.id} className={`tinkr-doc ${d.id === doc.id ? "is-active" : ""}`}>
              {confirmDelete === d.id ? (
                <div className="flex w-full items-center justify-between px-3 py-2 text-[13px]">
                  <span>Delete this page?</span>
                  <span className="flex gap-3">
                    <button type="button" className="tinkr-quiet is-strong" onClick={() => remove(d.id)}>Delete</button>
                    <button type="button" className="tinkr-quiet" onClick={() => setConfirmDelete("")}>Keep</button>
                  </span>
                </div>
              ) : (
                <>
                  <button type="button" className="tinkr-doc-open" onClick={() => open(d.id)}>
                    {d.title.trim() || "Untitled"}
                  </button>
                  <button
                    type="button"
                    className="tinkr-doc-delete"
                    aria-label={`Delete ${d.title.trim() || "Untitled"}`}
                    onClick={() => setConfirmDelete(d.id)}
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </nav>
        {saveFailed && (
          <p className="px-5 pb-4 text-[12px] text-warn" role="alert">
            Couldn&apos;t save to this browser. Copy your work somewhere safe.
          </p>
        )}
      </aside>

      <aside className={`tinkr-chat ${panel === "chat" ? "is-open" : ""}`} aria-label="Chat" inert={panel !== "chat"}>
        <Chat
          feed={doc.feed}
          busy={chatting}
          error={chatError}
          inputRef={chatInput}
          onAsk={ask}
          onClose={() => setPanel(null)}
        />
      </aside>
    </div>
  );
}
