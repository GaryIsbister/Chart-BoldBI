import Anthropic from "@anthropic-ai/sdk";
import { getSecret, keys } from "../keychain";

let cached: { client: Anthropic; key: string } | null = null;

export const getClaude = async (): Promise<Anthropic> => {
  const apiKey = await getSecret(keys.anthropicApiKey);
  if (!apiKey) throw new Error("Anthropic API key not set. Configure it in Settings.");
  if (cached && cached.key === apiKey) return cached.client;
  const client = new Anthropic({ apiKey });
  cached = { client, key: apiKey };
  return client;
};

// Default models per claude-api skill: Opus 4.7 for synthesis, Sonnet 4.6 for high-volume classification.
export const MODELS = {
  classifier: "claude-sonnet-4-6",
  synthesis: "claude-opus-4-7",
} as const;
