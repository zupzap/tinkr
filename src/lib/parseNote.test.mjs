import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNote } from "./parseNote.ts";

test("reads the expected JSON", () => {
  assert.deepEqual(parseNote('{"quote":"the map","note":"Why a map?","replyTo":2}'), {
    text: "Why a map?",
    quote: "the map",
    replyNumber: 2,
  });
});

test("staying quiet stays quiet", () => {
  assert.equal(parseNote('{"note":null}'), null);
  assert.equal(parseNote("null"), null);
  assert.equal(parseNote("   "), null);
});

test("keeps a comment that arrived as plain text", () => {
  assert.deepEqual(parseNote("What if the output isn't a document at all?"), {
    text: "What if the output isn't a document at all?",
    quote: "",
  });
});

test("keeps a plain comment wrapped in quotation marks", () => {
  assert.equal(parseNote('"What if free stays the habit?"').text, "What if free stays the habit?");
});

test("splits a quoted first line from the comment under it", () => {
  assert.deepEqual(parseNote('"what will the end product be"\n\nMaybe output is the wrong frame.'), {
    text: "Maybe output is the wrong frame.",
    quote: "what will the end product be",
  });
});

test("keeps line breaks in a plain list of options", () => {
  assert.equal(parseNote("Three angles:\n\n- price\n- speed").text, "Three angles:\n\n- price\n- speed");
});

test("rescues a comment from JSON that was cut off", () => {
  assert.deepEqual(parseNote('{"quote":"on a Tuesday","note":"A flat \\"Tuesday\\" lands hard'), {
    text: 'A flat "Tuesday" lands hard',
    quote: "on a Tuesday",
  });
});

test("gives up on JSON cut off before the comment", () => {
  assert.equal(parseNote('{"quote":"fair","'), null);
});
