import keytar from "keytar";

const SERVICE = "investor-tracker";

export const keychain = {
  async get(account: string): Promise<string | null> {
    return keytar.getPassword(SERVICE, account);
  },
  async set(account: string, value: string): Promise<void> {
    await keytar.setPassword(SERVICE, account, value);
  },
  async delete(account: string): Promise<void> {
    await keytar.deletePassword(SERVICE, account);
  },
};

export const KeychainAccount = {
  msalCache: "msal-token-cache",
  anthropicApiKey: "anthropic-api-key",
} as const;
