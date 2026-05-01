import { z } from "zod";
import { getAnthropic } from "./client";

const DemandBookEntry = z.object({
  entityName: z.string(),
  contactNames: z.array(z.string()).default([]),
  contactEmails: z.array(z.string()).default([]),
  ticketSize: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});

const ParseResult = z.object({
  entries: z.array(DemandBookEntry),
});
export type DemandBookParseResult = z.infer<typeof ParseResult>;

const SYSTEM = `You parse a "demand book" email into structured entries describing each prospective investor entity.
Return strictly JSON matching:
{
  "entries": [
    {
      "entityName": string,
      "contactNames": string[],
      "contactEmails": string[],
      "ticketSize": string | null,
      "notes": string | null
    }
  ]
}
- Lift email addresses verbatim, lowercase them.
- Use the firm/entity name (not the contact name) as entityName.
- If a contact appears with no entity, group them under their firm if it can be inferred from email domain or context; otherwise use the contact name.
- Be lossless: anything that looks like a sizing/commitment note should land in ticketSize, freeform commentary in notes.`;

const tryParseJson = (text: string): unknown => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`no JSON object in demand book response: ${text}`);
  return JSON.parse(match[0]);
};

export const parseDemandBookEmail = async (
  bodyText: string,
  model: string,
): Promise<DemandBookParseResult> => {
  const client = await getAnthropic();
  const resp = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Demand book email body:\n\n${bodyText.slice(0, 80000)}\n\nReturn JSON only.`,
      },
    ],
  });
  const text = resp.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n");
  return ParseResult.parse(tryParseJson(text));
};
