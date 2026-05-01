import keytar from "keytar";

const SERVICE = "investor-tracker";

export const keychain = {
  get: (account: string): Promise<string | null> => keytar.getPassword(SERVICE, account),
  set: (account: string, secret: string): Promise<void> => keytar.setPassword(SERVICE, account, secret),
  delete: (account: string): Promise<boolean> => keytar.deletePassword(SERVICE, account),
};

export const KEYCHAIN_KEYS = {
  ANTHROPIC_API_KEY: "anthropic_api_key",
  MICROSOFT_REFRESH_TOKEN: "microsoft_refresh_token",
  MICROSOFT_ACCOUNT: "microsoft_account",
} as const;
