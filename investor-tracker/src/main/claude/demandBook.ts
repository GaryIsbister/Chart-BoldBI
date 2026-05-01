import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getClaude, MODELS } from "./client";

export const DemandBookParse = z.object({
  entries: z.array(
    z.object({
      entityName: z.string(),
      contactNames: z.array(z.string()).default([]),
      contactEmails: z.array(z.string()).default([]),
      ticketSize: z.string().nullable().default(null),
      notes: z.string().nullable().default(null),
    }),
  ),
});
export type DemandBookParse = z.infer<typeof DemandBookParse>;

const SYSTEM = `You parse a fund's "demand book" from Marina at Foremost. The demand book lists firms that have expressed interest in investing.

Extract structured rows: one per firm (the entity), aggregating any contacts mentioned for that firm.

For each entry:
- entityName: the firm/fund name (NOT a person).
- contactNames: people listed as the firm's contacts.
- contactEmails: their emails (lowercase).
- ticketSize: any indicated commitment or range (e.g. "$5-10M", "TBD", "$25M committed"); null if absent.
- notes: anything that captures context (interest level, last touch, blockers); null if absent.

Return JSON only matching: {"entries": [...]}`;

export const parseDemandBook = async (rawText: string): Promise<DemandBookParse> => {
  const client = await getClaude();
  const response = await client.messages.create({
    model: MODELS.synthesis,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Demand book text:\n${rawText}\n\nReturn strict JSON only.`,
      },
    ],
  } satisfies Anthropic.MessageCreateParams);

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error(`Demand book parse returned non-JSON: ${text.slice(0, 200)}`);
  }
  return DemandBookParse.parse(JSON.parse(text.slice(start, end + 1)));
};

export const renderDemandBookContext = (parsed: DemandBookParse): string => {
  if (!parsed.entries.length) return "(no demand book imported yet)";
  return parsed.entries
    .map((e) => {
      const contacts = e.contactNames.length || e.contactEmails.length
        ? ` contacts=${e.contactNames.join(", ")} <${e.contactEmails.join(", ")}>`
        : "";
      const ticket = e.ticketSize ? ` ticket=${e.ticketSize}` : "";
      const notes = e.notes ? ` notes=${e.notes}` : "";
      return `- ${e.entityName}${contacts}${ticket}${notes}`;
    })
    .join("\n");
};
