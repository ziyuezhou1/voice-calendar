import assert from "node:assert/strict";
import {
  createAccountSession,
  getAccountEventsKey,
  getAccountLabel,
  normalizeAccountId,
} from "../src/account-core.js";

const now = new Date("2026-05-30T10:00:00.000Z");

{
  const account = createAccountSession("google", " User@Gmail.COM ", now);
  assert.equal(account.provider, "google");
  assert.equal(account.accountId, "user@gmail.com");
  assert.equal(account.displayName, "User@Gmail.COM");
  assert.equal(account.signedInAt, "2026-05-30T10:00:00.000Z");
}

{
  const account = createAccountSession("wechat", "  小 周  ", now);
  assert.equal(account.provider, "wechat");
  assert.equal(account.accountId, "小 周");
  assert.equal(getAccountLabel(account), "微信 · 小 周");
}

{
  assert.equal(normalizeAccountId("  A   B  "), "a b");
  assert.equal(getAccountEventsKey("voice-calendar-events-v1", null), "voice-calendar-events-v1");
  assert.equal(
    getAccountEventsKey("voice-calendar-events-v1", createAccountSession("google", "user@gmail.com", now)),
    "voice-calendar-events-v1:google:user%40gmail.com",
  );
}

assert.throws(() => createAccountSession("github", "user", now), /Unsupported/);
assert.throws(() => createAccountSession("google", " ", now), /required/);

console.log("account-core tests passed");
