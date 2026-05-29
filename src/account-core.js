export const ACCOUNT_PROVIDERS = Object.freeze({
  google: {
    label: "Google",
    avatar: "G",
    placeholder: "name@gmail.com",
  },
  wechat: {
    label: "微信",
    avatar: "微",
    placeholder: "微信昵称或 OpenID",
  },
});

export function normalizeAccountId(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function createAccountSession(provider, identity, now = new Date()) {
  if (!Object.prototype.hasOwnProperty.call(ACCOUNT_PROVIDERS, provider)) {
    throw new Error("Unsupported login provider");
  }

  const accountId = normalizeAccountId(identity);
  if (!accountId) throw new Error("Account identity is required");

  return {
    provider,
    accountId,
    displayName: String(identity).trim().replace(/\s+/g, " "),
    signedInAt: new Date(now).toISOString(),
  };
}

export function getAccountEventsKey(baseKey, account) {
  if (!account?.provider || !account?.accountId) return baseKey;
  return `${baseKey}:${account.provider}:${encodeURIComponent(account.accountId)}`;
}

export function getProviderLabel(provider) {
  return ACCOUNT_PROVIDERS[provider]?.label || "账号";
}

export function getAccountLabel(account) {
  if (!account?.provider || !account?.displayName) return "访客";
  return `${getProviderLabel(account.provider)} · ${account.displayName}`;
}
