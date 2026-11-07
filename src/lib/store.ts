import type { JSONContent } from "@tiptap/react";

export type Move = "auto" | "pushback" | "clarify" | "deeper";
export type Lens = "open" | "product";

export type FeedItem = { id: string; role: "you" | "partner"; text: string; at: number };

export type Turn = { role: "you" | "partner"; text: string };

/** A comment in the margin. Its passage is marked in the document by the same id. */
export type Note = {
  id: string;
  quote: string;
  anchored: boolean;
  turns: Turn[];
  at: number;
  /** The earlier comment their writing was answering, when it was. */
  replyTo?: string;
};

export type Doc = {
  id: string;
  title: string;
  content: JSONContent | null;
  text: string;
  lens: Lens;
  notes: Note[];
  feed: FeedItem[];
  updatedAt: number;
};

export type Saved = { docs: Doc[]; activeId: string };

export type Starter = { name: string; hint: string; lens: Lens; sections: string[] };

export const STARTERS: Starter[] = [
  { name: "Blank", hint: "Just write", lens: "open", sections: [] },
  {
    name: "PRD",
    hint: "Shape a feature",
    lens: "product",
    sections: ["Problem", "Who it's for", "Evidence", "Goal and metric", "Approach", "Risks", "Not doing"],
  },
  {
    name: "Decision",
    hint: "Make a call",
    lens: "product",
    sections: ["The decision", "Options", "What we know", "What we're assuming", "Recommendation", "What would change our mind"],
  },
  {
    name: "Research",
    hint: "Make sense of what you heard",
    lens: "product",
    sections: ["Who we talked to", "What we heard", "Patterns", "What surprised us", "What we'd do next"],
  },
];

const KEY = "tinkr.v1";

export const uid = () => crypto.randomUUID();

export function newDoc(starter: Starter = STARTERS[0]): Doc {
  const content: JSONContent | null = starter.sections.length
    ? {
        type: "doc",
        content: starter.sections.flatMap((text) => [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] },
          { type: "paragraph" },
        ]),
      }
    : null;
  return {
    id: uid(),
    title: "",
    content,
    text: starter.sections.join("\n\n"),
    lens: starter.lens,
    notes: [],
    feed: [],
    updatedAt: Date.now(),
  };
}

/** Fills in fields added since a page was saved, and drops the retired inline comment blocks. */
function upgrade(doc: Doc): Doc {
  const content = doc.content?.content
    ? { ...doc.content, content: doc.content.content.filter((n) => n.type !== "partnerNote") }
    : doc.content;
  return {
    ...doc,
    content,
    lens: doc.lens ?? "open",
    // Replies written on the page used to be copied into threads; the page already has them.
    notes: (doc.notes ?? []).map((n) => ({
      ...n,
      turns: n.turns.filter((t) => !("page" in t)),
    })),
    feed: doc.feed.filter((i) => i.role === "you" || i.role === "partner"),
  };
}

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Saved;
      if (saved.docs?.length) {
        const activeId = saved.docs.some((d) => d.id === saved.activeId)
          ? saved.activeId
          : saved.docs[0].id;
        return { docs: saved.docs.map(upgrade), activeId };
      }
    }
  } catch {
    // Unreadable or blocked storage: start fresh rather than fail to open.
  }
  const doc = newDoc();
  return { docs: [doc], activeId: doc.id };
}

const NOTICE_KEY = "tinkr.notice";

export function noticeSeen() {
  try {
    return localStorage.getItem(NOTICE_KEY) === "seen";
  } catch {
    return false;
  }
}

export function markNoticeSeen() {
  try {
    localStorage.setItem(NOTICE_KEY, "seen");
  } catch {
    // Blocked storage only means they see the notice again next time.
  }
}

export function save(state: Saved): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
