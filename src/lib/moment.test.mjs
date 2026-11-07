import assert from "node:assert/strict";
import { test } from "node:test";
import { kept, readMoment } from "./moment.ts";

test("a half-written sentence waits for a long silence", () => {
  const moment = readMoment("i am still not super sure on the");
  assert.equal(moment.delay, 8000);
  assert.equal(moment.urgent, false);
});

test("a finished sentence gets a short wait", () => {
  assert.equal(readMoment("This is the plan.").delay, 1500);
  assert.equal(readMoment('She said "enough."').delay, 1500);
});

test("a question is a natural place to respond", () => {
  const moment = readMoment("why is this different?");
  assert.equal(moment.delay, 1500);
  assert.equal(moment.urgent, true);
});

test("a fresh line means they finished the one above", () => {
  assert.deepEqual(readMoment("   "), { delay: 800, urgent: true });
});

test("works for writing in any language", () => {
  assert.equal(readMoment("yaar samajh nahi aa raha ki").delay, 8000);
});

test("continuing the same passage cancels the comment", () => {
  assert.equal(kept("i am not sure on the value we want", "i am not sure on the"), true);
});

test("moving on to a new line keeps the comment", () => {
  assert.equal(kept("a brand new thought", "i am not sure on the"), false);
  assert.equal(kept("i am not sure on the", "i am not sure on the"), false);
});
