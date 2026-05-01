import { z } from "zod";
import { getClaude, MODELS } from "./client";
import type Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@shared/types";

export const ClassifierResult = z.object({
  isPotentialInvestor: z.boolean(),
  confidence: z.number().min(0).max(1),
  proposedEntityName: z.string(),
  reasoning: z.string(),
  matchedDemandBookEntry: z.string().nullable(),
});
export type ClassifierResult = z.infer<typeof ClassifierResult>;

const SYSTEM_PROMPT = `You classify whether an external email sender is a potential investor or risk participant for a trade-finance fund.

You receive:
1. The latest investor demand book context (interested investors, prior conversations).
2. A new sender's email address, display name, and a few recent messages they sent.

Decide:
- isPotentialInvestor: true only if there's evidence they may want to invest or already invest. False for vendors, lawyers, recruiters, marketing, internal staff, or generic counterparties.
- confidence: your probability they are an investor (0.0 - 1.0).
- proposedEntityName: the firm/fund name (NOT the person). If multiple senders share a domain, group under one entity name. Use the demand book to align with the canonical name when present.
- reasoning: 1-3 sentences explaining the call.
- matchedDemandBookEntry: the exact entity name from the demand book if matched, else null.

Return JSON only.`;

export const classifySender = async (params: {
  demandBookContext: string;
  email: string;
  displayName: string | null;
  recentMessages: Message[];
}): Promise<ClassifierResult> => {
  const client = await getClaude();
  const evidence = params.recentMessages
    .map(
      (m) =>
        `[${m.receivedAt}] subj="${m.subject ?? ""}" preview="${m.bodyPreview.slice(0, 400)}"`,
    )
    .join("\n");

  const userPrompt = `Sender email: ${params.email}
Display name: ${params.displayName ?? "(none)"}
Domain: ${params.email.split("@")[1] ?? ""}

Recent messages from this sender:
${evidence || "(no recent messages preserved)"}

Respond with strict JSON matching: {"isPotentialInvestor": boolean, "confidence": number, "proposedEntityName": string, "reasoning": string, "matchedDemandBookEntry": string | null}`;

  const response = await client.messages.create({
    model: MODELS.classifier,
    max_tokens: 1024,
    system: [
      { type: "text", text: SYSTEM_PROMPT },
      {
        type: "text",
        text: `Investor demand book (canonical reference):\n${params.demandBookContext}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  } satisfies Anthropic.MessageCreateParams);

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error(`Classifier returned non-JSON output: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  return ClassifierResult.parse(parsed);
};
