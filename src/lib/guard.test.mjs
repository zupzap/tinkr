import assert from "node:assert/strict";
import { test } from "node:test";
import { createLimiter, fromOwnSite } from "./guard.ts";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const sites = new Set(["tinkr.page", "www.tinkr.page"]);

test("accepts the app's own pages", () => {
  assert.equal(fromOwnSite("https://tinkr.page", "tinkr.page", sites), true);
  assert.equal(fromOwnSite("https://www.tinkr.page", "www.tinkr.page", sites), true);
});

test("rejects other sites and scripts with no origin", () => {
  assert.equal(fromOwnSite("https://evil.example", "tinkr.page", sites), false);
  assert.equal(fromOwnSite("https://tinkr.page.evil.example", "tinkr.page", sites), false);
  assert.equal(fromOwnSite(null, "tinkr.page", sites), false);
  assert.equal(fromOwnSite("not a url", "tinkr.page", sites), false);
});

test("deployment URLs can't reach the API even when origin matches host", () => {
  assert.equal(fromOwnSite("https://tinkr-abc.vercel.app", "tinkr-abc.vercel.app", sites), false);
});

test("stops a visitor over the minute limit, then lets them back", () => {
  const allow = createLimiter({ perMinute: 2, perDay: 100, everyonePerDay: 100 });
  assert.equal(allow("a", 0), true);
  assert.equal(allow("a", 1), true);
  assert.equal(allow("a", 2), false);
  assert.equal(allow("a", MINUTE + 3), true);
});

test("one visitor's limit doesn't affect another", () => {
  const allow = createLimiter({ perMinute: 1, perDay: 100, everyonePerDay: 100 });
  assert.equal(allow("a", 0), true);
  assert.equal(allow("a", 1), false);
  assert.equal(allow("b", 2), true);
});

test("stops a visitor over the daily limit until the next day", () => {
  const allow = createLimiter({ perMinute: 100, perDay: 2, everyonePerDay: 100 });
  allow("a", 0);
  allow("a", 1);
  assert.equal(allow("a", 2 * MINUTE), false);
  assert.equal(allow("a", DAY + 1), true);
});

test("the shared cap stops everyone, however many visitors there are", () => {
  const allow = createLimiter({ perMinute: 100, perDay: 100, everyonePerDay: 2 });
  assert.equal(allow("a", 0), true);
  assert.equal(allow("b", 1), true);
  assert.equal(allow("c", 2), false);
});
