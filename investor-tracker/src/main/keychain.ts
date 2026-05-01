import keytar from "keytar";

const SERVICE = "investor-tracker";

export const keys = {
  anthropicApiKey: "anthropic-api-key",
  msalAccountCache: "msal-account-cache",
} as const;

export const getSecret = (key: string): Promise<string | null> => keytar.getPassword(SERVICE, key);

export const setSecret = (key: string, value: string): Promise<void> =>
  keytar.setPassword(SERVICE, key, value);

export const deleteSecret = (key: string): Promise<boolean> => keytar.deletePassword(SERVICE, key);
