import assert from "node:assert/strict";
import {
  createAccountSession,
  createPhoneAccount,
  createSmsVerification,
  getAccountEventsKey,
  getAccountLabel,
  getSmsVerificationRemainingSeconds,
  isPhoneValid,
  isSmsVerificationValid,
  maskPhone,
  normalizePhone,
  validatePassword,
  verifyPhoneAccountPassword,
} from "../src/account-core.js";

const now = new Date("2026-05-30T10:00:00.000Z");

{
  assert.equal(normalizePhone(" 138 0013-8000 "), "13800138000");
  assert.equal(normalizePhone("+86 138 0013 8000"), "+8613800138000");
  assert.equal(isPhoneValid("13800138000"), true);
  assert.equal(isPhoneValid("+85291234567"), true);
  assert.equal(isPhoneValid("12345"), false);
  assert.equal(maskPhone("13800138000"), "138****8000");
}

{
  assert.deepEqual(validatePassword("12345"), { valid: false, message: "密码至少需要 6 位。" });
  assert.equal(validatePassword("123456").valid, true);
}

{
  const verification = createSmsVerification("13800138000", now, "123456");
  assert.equal(verification.phone, "13800138000");
  assert.equal(verification.code, "123456");
  assert.equal(verification.expiresAt, "2026-05-30T10:05:00.000Z");
  assert.equal(isSmsVerificationValid(verification, "13800138000", "123456", new Date("2026-05-30T10:04:59.000Z")), true);
  assert.equal(isSmsVerificationValid(verification, "13800138000", "123456", new Date("2026-05-30T10:05:01.000Z")), false);
  assert.equal(isSmsVerificationValid(verification, "13800138000", "000000", now), false);
  assert.equal(getSmsVerificationRemainingSeconds(verification, now), 300);
}

{
  const account = createPhoneAccount("13800138000", "secret1", now);
  assert.equal(account.provider, "phone");
  assert.equal(account.accountId, "13800138000");
  assert.equal(account.displayName, "138****8000");
  assert.equal(verifyPhoneAccountPassword(account, "secret1"), true);
  assert.equal(verifyPhoneAccountPassword(account, "wrong-password"), false);
}

{
  const session = createAccountSession("13800138000", now);
  assert.equal(session.provider, "phone");
  assert.equal(session.accountId, "13800138000");
  assert.equal(session.displayName, "138****8000");
  assert.equal(session.signedInAt, "2026-05-30T10:00:00.000Z");
  assert.equal(getAccountLabel(session), "手机号 · 138****8000");
  assert.equal(getAccountEventsKey("voice-calendar-events-v1", null), "voice-calendar-events-v1");
  assert.equal(getAccountEventsKey("voice-calendar-events-v1", session), "voice-calendar-events-v1:phone:13800138000");
}

assert.throws(() => createSmsVerification("12345", now), /invalid/);
assert.throws(() => createPhoneAccount("13800138000", "12345", now), /密码至少需要 6 位/);
assert.throws(() => createAccountSession("12345", now), /invalid/);

console.log("account-core tests passed");
