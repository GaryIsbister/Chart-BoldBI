import { z } from "zod";
import { getAnthropic } from "./client";

const ClassificationResult = z.object({
  isInvestor: z.boolean(),
  proposedEntityName: z.string(),
  matchedDemandBookEntry: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
export type ClassificationResult = z.infer<typeof ClassificationResult>;

export type ClassifyInput = {
  email: string;
  displayName: string | null;
  domain: string | null;
  subjectsAndPreviews: { subject: string | null; preview: string }[];
  knownEntities: { name: string; domain: string | null }[];
  demandBook: { entityName: string; contactEmails: string[] }[];
  model: string;
};

const SYSTEM = `You are classifying whether an email sender is a prospective investor in our fund and which entity they represent.
Return strictly JSON matching the schema. Be conservative: if you cannot tell from the evidence whether the sender is an investor or which entity they belong to, lower confidence accordingly.

Schema:
{
  "isInvestor": boolean,
  "proposedEntityName": string,           // your best guess; "" if not an investor
  "matchedDemandBookEntry": string | null,// entity name from the demand book if matched, else null
  "confidence": number,                    // 0..1, your belief in the classification
  "reasoning": string                      // 1-3 sentences citing evidence
}`;

const buildPrompt = (input: ClassifyInput): string => {
  const evidence = input.subjectsAndPreviews
    .slice(0, 10)
    .map(
      (m, i) => `[${i + 1}] subject: ${m.subject ?? "(none)"}\n    preview: ${m.preview.slice(0, 600)}`,
    )
    .join("\n");
  const knownLines = input.knownEntities
    .slice(0, 200)
    .map((e) => `- ${e.name}${e.domain ? ` (${e.domain})` : ""}`)
    .join("\n");
  const demandLines = input.demandBook
    .slice(0, 500)
    .map((e) => `- ${e.entityName}: ${e.contactEmails.join(", ")}`)
    .join("\n");

  return `Sender: ${input.displayName ?? ""} <${input.email}>
Domain: ${input.domain ?? "(unknown)"}

Recent messages from this sender:
${evidence || "(none)"}

Known entities we already track:
${knownLines || "(none)"}

Demand book (entities and their listed contacts):
${demandLines || "(none)"}

Return JSON only, no prose.`;
};

const tryParseJson = (text: string): unknown => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`no JSON object in classifier response: ${text}`);
  return JSON.parse(match[0]);
};

export const classifySender = async (
  input: ClassifyInput,
): Promise<ClassificationResult> => {
  const client = await getAnthropic();
  const resp = await client.messages.create({
    model: input.model,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: buildPrompt(input) }],
  });
  const text = resp.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n");
  return ClassificationResult.parse(tryParseJson(text));
};
