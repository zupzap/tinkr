"use client";

import { forwardRef, useImperativeHandle } from "react";
import { Mark } from "@tiptap/core";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { addAnchor, ANCHOR, findRange } from "@/lib/anchor";
import { readMoment, type Moment } from "@/lib/moment";
import type { Move } from "@/lib/store";

const NoteAnchor = Mark.create({
  name: ANCHOR,
  inclusive: false,
  excludes: "",
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-note-anchor"),
        renderHTML: (attrs) => ({ "data-note-anchor": attrs.id }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-note-anchor]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, class: "tinkr-anchor" }, 0];
  },
});

export type EditorHandle = {
  focus: () => void;
  /** The writing around the cursor, and whether now is a natural moment to respond. */
  context: () => Moment & { focus: string; line: string };
  /** Underlines the passage a comment is about. False if the page has nothing to underline. */
  anchor: (id: string, quote: string) => boolean;
};

export type Change = { content: JSONContent; text: string; typed: boolean };

type Props = {
  content: JSONContent | null;
  onChange: (change: Change) => void;
  onMove: (move: Move, selection: string) => void;
};

const MOVES: { move: Move; label: string }[] = [
  { move: "pushback", label: "Push back" },
  { move: "clarify", label: "Clarify" },
  { move: "deeper", label: "Go deeper" },
];

const Editor = forwardRef<EditorHandle, Props>(function Editor({ content, onChange, onMove }, ref) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      NoteAnchor,
      Placeholder.configure({ placeholder: "Write anything. I'll read along." }),
    ],
    content: content ?? undefined,
    editorProps: { attributes: { class: "tinkr-prose", "aria-label": "Your writing" } },
    onUpdate: ({ editor, transaction }) =>
      onChange({
        content: editor.getJSON(),
        text: editor.getText({ blockSeparator: "\n\n" }),
        typed: !transaction.getMeta("tinkr"),
      }),
  });

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus("end"),
      context: () => {
        if (!editor) return { focus: "", line: "", ...readMoment("") };
        const { $from } = editor.state.selection;
        const line = $from.parent.textContent.trim();
        if (line) return { focus: line, line, ...readMoment(line) };
        // On a fresh line: they just finished the block above.
        let index = $from.index(0);
        while (index-- > 0) {
          const block = editor.state.doc.child(index);
          if (block.textContent.trim()) return { focus: block.textContent, line, ...readMoment("") };
        }
        return { focus: "", line, ...readMoment("") };
      },
      anchor: (id, quote) => {
        if (!editor) return false;
        const range = findRange(editor.state, quote);
        if (!range) return false;
        editor.view.dispatch(addAnchor(editor.state, id, range));
        return true;
      },
    }),
    [editor],
  );

  if (!editor) return null;

  const selected = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, "\n\n");
  };

  return (
    <>
      <BubbleMenu editor={editor} className="tinkr-bubble">
        {MOVES.map(({ move, label }) => (
          <button key={move} type="button" onClick={() => onMove(move, selected())}>
            {label}
          </button>
        ))}
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
});

export default Editor;
