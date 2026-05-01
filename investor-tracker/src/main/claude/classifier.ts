import { getClaude } from "./client";
import { getSettings } from "../store/repositories/settings";
import type { Message } from "@shared/types";
import { domainFromEmail } from "@shared/util";

export interface ClassifierResult {
  isInvestor: boolean;
  proposedEntityName: string;
  confidence: number;
  reasoning: string;
  matchedDemandBookEntry: string | null;
}

interface ClassifierContext {
  message: Message;
  demandBookContext: string;
  knownEntities: string[];
}

const SYSTEM_PROMPT = `You are an assistant that helps a venture investor identify which inbound emails and Teams messages are from prospective LP investors versus general business correspondence.

Given:
- A single message (sender, subject, preview)
- A short "demand book" excerpt of investors who have expressed interest in the current fundraise
- A list of known investor entities already tracked

Decide:
1. Is the sender plausibly an investor (LP, GP, family office, fund-of-funds, allocator, advisor representing one)?
2. Which entity (firm/family) does the sender belong to? Use a stable canonical name.
3. Confidence in [0, 1].
4. Whether the sender matches a row in the demand book.

Output JSON ONLY with keys: is_investor (bool), proposed_entity_name (string), confidence (number), reasoning (string, <=2 sentences), matched_demand_book_entry (string|null).`;

const buildUserPrompt = (ctx: ClassifierContext): string => {
  const m = ctx.message;
  const lines = [
    `From: ${m.fromName ?? ""} <${m.fromEmail}>`,
    `Domain: ${domainFromEmail(m.fromEmail) ?? "(unknown)"}`,
    `Source: ${m.source}`,
    `Subject: ${m.subject ?? ""}`,
    `Preview: ${m.bodyPreview.slice(0, 800)}`,
    "",
    "Known tracked entities:",
    ctx.knownEntities.slice(0, 50).map((n) => `- ${n}`).join("\n") || "(none)",
    "",
    "Demand book excerpt:",
    ctx.demandBookContext || "(none)",
  ];
  return lines.join("\n");
};

const extractJson = (text: string): unknown => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Classifier: no JSON in response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
};

export const classifyMessage = async (
  ctx: ClassifierContext,
): Promise<ClassifierResult> => {
  const claude = await getClaude();
  const settings = getSettings();
  const response = await claude.messages.create({
    model: settings.classifierModel,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(ctx) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Classifier: no text block in response");
  }
  const parsed = extractJson(textBlock.text) as {
    is_investor?: boolean;
    proposed_entity_name?: string;
    confidence?: number;
    reasoning?: string;
    matched_demand_book_entry?: string | null;
  };
  return {
    isInvestor: Boolean(parsed.is_investor),
    proposedEntityName: parsed.proposed_entity_name ?? "Unknown",
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
    reasoning: parsed.reasoning ?? "",
    matchedDemandBookEntry: parsed.matched_demand_book_entry ?? null,
  };
};
