import assert from "node:assert/strict";
import { test } from "node:test";
import { placeNotes } from "./layout.ts";

const both = ["right", "left"];
const slot = (id, top, height = 100) => ({ id, top, height });

test("a lone comment sits level with its passage on the right", () => {
  assert.deepEqual(placeNotes([slot("a", 300)], both, 20), [{ id: "a", top: 300, side: "right" }]);
});

test("comments on nearby lines split across the two sides", () => {
  const out = placeNotes([slot("a", 100), slot("b", 120), slot("c", 140)], both, 20);
  assert.deepEqual(out.map((n) => n.side), ["right", "left", "right"]);
  assert.equal(out[1].top, 120);
  assert.equal(out[2].top, 220);
});

test("a tall comment sends the next ones to the free side", () => {
  const out = placeNotes([slot("a", 0, 600), slot("b", 50), slot("c", 200)], both, 20);
  assert.deepEqual(out.map((n) => n.side), ["right", "left", "left"]);
  assert.equal(out[2].top, 200);
});

test("comments far apart never overlap and stay level with their passages", () => {
  const out = placeNotes([slot("a", 0), slot("b", 800)], both, 20);
  assert.equal(out[1].top, 800);
});

test("with one side available everything stacks there without overlapping", () => {
  const out = placeNotes([slot("a", 100), slot("b", 110)], ["right"], 20);
  assert.deepEqual(out, [
    { id: "a", top: 100, side: "right" },
    { id: "b", top: 220, side: "right" },
  ]);
});
