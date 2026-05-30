export const PHONE_ACCOUNT_PROVIDER = Object.freeze({
  provider: "phone",
  label: "手机号",
  avatar: "号",
  placeholder: "请输入手机号",
});

export const SMS_CODE_TTL_MS = 5 * 60 * 1000;

export function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("+")) return `+${raw.slice(1).replace(/\D/g, "")}`;
  return raw.replace(/\D/g, "");
}

export function isPhoneValid(value) {
  const phone = normalizePhone(value);
  return /^1[3-9]\d{9}$/.test(phone) || /^\+[1-9]\d{7,14}$/.test(phone);
}

export function maskPhone(value) {
  const phone = normalizePhone(value);
  if (!phone) return "";
  if (phone.startsWith("+")) {
    const prefix = phone.slice(0, Math.min(4, phone.length - 4));
    return `${prefix}****${phone.slice(-4)}`;
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 6) return { valid: false, message: "密码至少需要 6 位。" };
  if (password.length > 32) return { valid: false, message: "密码最多 32 位。" };
  return { valid: true, message: "" };
}

export function createSmsVerification(phoneValue, now = new Date(), code = generateSmsCode()) {
  const phone = normalizePhone(phoneValue);
  if (!isPhoneValid(phone)) throw new Error("Phone number is invalid");

  const createdAt = new Date(now);
  return {
    phone,
    code: String(code).replace(/\D/g, "").padStart(6, "0").slice(-6),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + SMS_CODE_TTL_MS).toISOString(),
  };
}

export function isSmsVerificationValid(verification, phoneValue, codeValue, now = new Date()) {
  if (!verification) return false;
  const phone = normalizePhone(phoneValue);
  const code = String(codeValue || "").replace(/\D/g, "");
  return verification.phone === phone && verification.code === code && new Date(verification.expiresAt) >= new Date(now);
}

export function getSmsVerificationRemainingSeconds(verification, now = new Date()) {
  if (!verification) return 0;
  return Math.max(0, Math.ceil((new Date(verification.expiresAt).getTime() - new Date(now).getTime()) / 1000));
}

export function createPhoneAccount(phoneValue, passwordValue, now = new Date()) {
  const phone = normalizePhone(phoneValue);
  if (!isPhoneValid(phone)) throw new Error("Phone number is invalid");

  const passwordCheck = validatePassword(passwordValue);
  if (!passwordCheck.valid) throw new Error(passwordCheck.message);

  const timestamp = new Date(now).toISOString();
  return {
    provider: PHONE_ACCOUNT_PROVIDER.provider,
    accountId: phone,
    displayName: maskPhone(phone),
    passwordHash: hashPassword(phone, passwordValue),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function verifyPhoneAccountPassword(account, passwordValue) {
  if (!account?.accountId || !account?.passwordHash) return false;
  return account.passwordHash === hashPassword(account.accountId, passwordValue);
}

export function createAccountSession(phoneValue, now = new Date()) {
  const phone = normalizePhone(phoneValue);
  if (!isPhoneValid(phone)) throw new Error("Phone number is invalid");

  return {
    provider: PHONE_ACCOUNT_PROVIDER.provider,
    accountId: phone,
    displayName: maskPhone(phone),
    signedInAt: new Date(now).toISOString(),
  };
}

export function getAccountEventsKey(baseKey, account) {
  if (!account?.provider || !account?.accountId) return baseKey;
  return `${baseKey}:${account.provider}:${encodeURIComponent(account.accountId)}`;
}

export function getProviderLabel(provider) {
  return provider === PHONE_ACCOUNT_PROVIDER.provider ? PHONE_ACCOUNT_PROVIDER.label : "账号";
}

export function getAccountLabel(account) {
  if (!account?.provider || !account?.displayName) return "访客";
  return `${getProviderLabel(account.provider)} · ${account.displayName}`;
}

export function generateSmsCode(random = Math.random) {
  return String(Math.floor(random() * 1000000)).padStart(6, "0");
}

function hashPassword(phone, passwordValue) {
  const input = `${phone}:${String(passwordValue || "")}`;
  let hash = 2166136261;
  for (const character of input) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `demo-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
