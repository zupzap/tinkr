"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/lib/store";

type Props = {
  feed: FeedItem[];
  busy: boolean;
  error: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onAsk: (message: string) => void;
  onClose: () => void;
};

export default function Chat({ feed, busy, error, inputRef, onAsk, onClose }: Props) {
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const tail = feed.at(-1);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [feed.length, tail?.text]);

  const send = () => {
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    onAsk(message);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-6 pb-3 pt-6">
        <h2 className="text-[15px] text-muted">Talk it through</h2>
        <button type="button" className="tinkr-quiet" onClick={onClose}>Close</button>
      </header>
      <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto px-6 py-3">
        {feed.length === 0 && <p className="tinkr-voice text-muted">Ask me anything about what you&apos;re writing.</p>}
        {feed.map((item) =>
          item.role === "you" ? (
            <p key={item.id} className="text-[16px] leading-relaxed text-muted">{item.text}</p>
          ) : (
            <p key={item.id} className="tinkr-voice whitespace-pre-wrap">{item.text || "…"}</p>
          ),
        )}
        {error && <p className="text-[13px] text-warn" role="alert">{error}</p>}
      </div>
      <footer className="px-6 pb-6 pt-3">
        <textarea
          ref={inputRef}
          className="tinkr-ask"
          rows={1}
          value={draft}
          placeholder="Think out loud…"
          aria-label="Talk to tinkr"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
      </footer>
    </div>
  );
}
