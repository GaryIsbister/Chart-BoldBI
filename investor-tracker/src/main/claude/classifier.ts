import { getClaude } from "./client";
import { getSettings } from "../store/repositories/settings";
import type { Message } from "@shared/types";
import { domainFromEmail } from "@shared/util";

export interface ClassifierResult {
  isInvestor: boolean;
  proposedEntityName: string;
  confidence: number;
  reasoning: string;
}

interface ClassifierContext {
  message: Message;
  searchContext: string;
  knownEntities: string[];
}

const buildSystemPrompt = (searchContext: string): string => {
  const trimmed = searchContext.trim();
  const userBlock = trimmed.length > 0
    ? `\n\nThe user is specifically looking for messages matching this description:\n"""\n${trimmed}\n"""\nA sender qualifies as an investor only if the message could plausibly be from someone matching this description. If the message has no relation to that description, return is_investor=false.`
    : "";

  return `You help a fundraising team identify which inbound emails and Teams messages are from prospective investors (LPs, GPs, family offices, allocators, advisors representing one) versus general business correspondence.

Given a single message and the team's search context, decide:
1. Is the sender plausibly an investor matching the search context?
2. Which firm/entity name does the sender belong to (use a stable canonical name like "Swedfund" not "Mr. X from Swedfund").
3. Confidence in [0, 1].
4. One- or two-sentence reasoning.${userBlock}

Output JSON ONLY with these keys: is_investor (bool), proposed_entity_name (string), confidence (number), reasoning (string).`;
};

const buildUserPrompt = (ctx: ClassifierContext): string => {
  const m = ctx.message;
  const lines = [
    `From: ${m.fromName ?? ""} <${m.fromEmail}>`,
    `Domain: ${domainFromEmail(m.fromEmail) ?? "(unknown)"}`,
    `Source: ${m.source}`,
    `Subject: ${m.subject ?? ""}`,
    `Preview: ${m.bodyPreview.slice(0, 800)}`,
    "",
    "Already-tracked investor entities (for canonical-name reuse):",
    ctx.knownEntities.slice(0, 50).map((n) => `- ${n}`).join("\n") || "(none)",
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
    system: buildSystemPrompt(ctx.searchContext),
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
  };
  return {
    isInvestor: Boolean(parsed.is_investor),
    proposedEntityName: parsed.proposed_entity_name ?? "Unknown",
    confidence:
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0,
    reasoning: parsed.reasoning ?? "",
  };
};
