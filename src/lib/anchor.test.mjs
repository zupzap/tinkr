import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { addAnchor, findRange, removeAnchor } from "./anchor.ts";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    text: {},
  },
  marks: {
    noteAnchor: { attrs: { id: { default: "" } }, inclusive: false, excludes: "" },
  },
});

const p = (text = "") => schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
const state = (blocks, from, to = from) => {
  const doc = schema.nodes.doc.create(null, blocks);
  return EditorState.create({ doc, selection: TextSelection.create(doc, from, to) });
};
const textOf = (s, r) => s.doc.textBetween(r.from, r.to);
const marked = (s, id) => {
  let out = "";
  s.doc.descendants((node) => {
    if (node.marks.some((m) => m.attrs.id === id)) out += node.text;
  });
  return out;
};

test("uses the selection first", () => {
  const s = state([p("one two three")], 5, 8);
  assert.equal(textOf(s, findRange(s, "three")), "two");
});

test("finds the passage the model quoted", () => {
  const s = state([p("Users never read emails."), p("Drop them.")], 3);
  assert.equal(textOf(s, findRange(s, "never read")), "never read");
});

test("prefers the newest copy of a repeated quote", () => {
  const s = state([p("same words"), p("same words")], 3);
  assert.equal(findRange(s, "same words").from, 13);
});

test("falls back to the last sentence before the cursor", () => {
  const s = state([p("First idea. Second idea is better."), p()], 37);
  assert.equal(textOf(s, findRange(s, "not in the page")), "Second idea is better.");
});

test("a question with no full stop anchors the whole line", () => {
  const s = state([p("why not use notion")], 19);
  assert.equal(textOf(s, findRange(s)), "why not use notion");
});

test("an empty page has nothing to anchor", () => {
  assert.equal(findRange(state([p()], 1)), null);
});

test("anchoring leaves the cursor, text and undo history alone", () => {
  const s = state([p("Users never read."), p("still typing")], 25);
  const tr = addAnchor(s, "a", { from: 7, to: 12 });
  const next = s.apply(tr);
  assert.equal(next.selection.from, 25);
  assert.equal(next.doc.textContent, s.doc.textContent);
  assert.equal(marked(next, "a"), "never");
  assert.equal(tr.getMeta("addToHistory"), false);
});

test("two comments can share a passage, and removing one keeps the other", () => {
  let s = state([p("Users never read.")], 1);
  s = s.apply(addAnchor(s, "a", { from: 1, to: 12 }));
  s = s.apply(addAnchor(s, "b", { from: 7, to: 18 }));
  s = s.apply(removeAnchor(s, "a"));
  assert.equal(marked(s, "a"), "");
  assert.equal(marked(s, "b"), "never read.");
});
