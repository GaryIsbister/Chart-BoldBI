import Anthropic from "@anthropic-ai/sdk";
import { keychain, KeychainAccount } from "../keychain";

let client: Anthropic | null = null;

export const getAnthropic = async (): Promise<Anthropic> => {
  if (client) return client;
  const key = await keychain.get(KeychainAccount.anthropicApiKey);
  if (!key) throw new Error("Anthropic API key not configured");
  client = new Anthropic({ apiKey: key });
  return client;
};

export const resetAnthropic = (): void => {
  client = null;
};
