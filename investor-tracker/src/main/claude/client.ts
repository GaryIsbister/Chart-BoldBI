import Anthropic from "@anthropic-ai/sdk";
import { KEYCHAIN_KEYS, keychain } from "../keychain";

let client: Anthropic | null = null;

export const getClaude = async (): Promise<Anthropic> => {
  if (client) return client;
  const apiKey = await keychain.get(KEYCHAIN_KEYS.ANTHROPIC_API_KEY);
  if (!apiKey) {
    throw new Error("Anthropic API key not configured. Open Settings and paste your key.");
  }
  client = new Anthropic({ apiKey });
  return client;
};

export const resetClaudeClient = (): void => {
  client = null;
};
