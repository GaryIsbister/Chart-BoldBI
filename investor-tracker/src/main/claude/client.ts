import Anthropic from "@anthropic-ai/sdk";
import { getClaudeKey } from "./key-store.js";

let cached: Anthropic | null = null;

export async function getAnthropic(): Promise<Anthropic> {
  if (cached) return cached;
  const apiKey = await getClaudeKey();
  if (!apiKey) {
    throw new Error(
      "Anthropic API key not set. Use Settings to add it, or set ANTHROPIC_API_KEY.",
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

export function resetAnthropicClient(): void {
  cached = null;
}

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export function summarizeUsage(usage: Usage): {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
} {
  return {
    inputTokens: usage.input_tokens,
    cachedInputTokens: usage.cache_read_input_tokens ?? 0,
    outputTokens: usage.output_tokens,
  };
}
