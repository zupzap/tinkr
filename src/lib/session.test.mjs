import assert from "node:assert/strict";
import { test } from "node:test";
import { createSession, passwordMatches, validSession } from "./session.ts";

const secret = "a-test-secret";
const DAY = 24 * 60 * 60 * 1000;

test("a fresh session is valid", async () => {
  assert.equal(await validSession(await createSession(secret, 1000), secret, 2000), true);
});

test("an expired session is rejected", async () => {
  assert.equal(await validSession(await createSession(secret, 0), secret, 31 * DAY), false);
});

test("a session signed with another secret is rejected", async () => {
  assert.equal(await validSession(await createSession("other", 1000), secret, 2000), false);
});

test("extending the expiry breaks the signature", async () => {
  const [, signature] = (await createSession(secret, 1000)).split(".");
  assert.equal(await validSession(`9999999999999.${signature}`, secret, 2000), false);
});

test("junk and missing values are rejected", async () => {
  for (const token of [undefined, "", "abc", "1.2", "1.2.3", `1.${"z".repeat(64)}`]) {
    assert.equal(await validSession(token, secret, 0), false);
  }
});

test("with no secret configured, nothing passes", async () => {
  assert.equal(await validSession(await createSession(secret, 1000), undefined, 2000), false);
  assert.equal(await passwordMatches("anything", "anything", undefined), false);
  assert.equal(await passwordMatches("anything", undefined, secret), false);
});

test("only the right password matches", async () => {
  assert.equal(await passwordMatches("right", "right", secret), true);
  assert.equal(await passwordMatches("wrong", "right", secret), false);
  assert.equal(await passwordMatches("", "right", secret), false);
});
