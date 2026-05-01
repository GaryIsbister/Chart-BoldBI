import { z } from "zod";
import { loadConfig } from "../config.js";
import { getAnthropic, summarizeUsage, type Usage } from "./client.js";
import { CLASSIFIER_SYSTEM } from "./prompts.js";

export type ContactForClassification = {
  contactId: string;
  displayName: string;
  email: string | null;
  domain: string | null;
  recentSnippets: string[];
};

const ResultSchema = z.object({
  classifications: z.array(
    z.object({
      contactId: z.string(),
      decision: z.enum(["investor", "not_investor", "uncertain"]),
      reason: z.string(),
      entity: z.object({
        existingEntityId: z.string().nullable(),
        suggestedName: z.string(),
        suggestedDomain: z.string().nullable(),
      }),
    }),
  ),
});

export type ClassificationResult = z.infer<typeof ResultSchema>;

export type ClassifyArgs = {
  demandBookText: string;
  contacts: ContactForClassification[];
};

export async function classifyContacts(args: ClassifyArgs): Promise<{
  result: ClassificationResult;
  usage: ReturnType<typeof summarizeUsage>;
}> {
  const cfg = loadConfig();
  const client = await getAnthropic();

  const userText = JSON.stringify(
    {
      schema: {
        classifications: [
          {
            contactId: "string (echo back)",
            decision: "investor | not_investor | uncertain",
            reason: "short string",
            entity: {
              existingEntityId: "string or null",
              suggestedName: "string",
              suggestedDomain: "string or null",
            },
          },
        ],
      },
      contacts: args.contacts,
    },
    null,
    2,
  );

  const response = await client.messages.create({
    model: cfg.claude.models.classifier,
    max_tokens: 4000,
    system: [
      { type: "text", text: CLASSIFIER_SYSTEM },
      {
        type: "text",
        text: `<demand_book>\n${args.demandBookText}\n</demand_book>`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userText }],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Classifier returned no text");
  }
  const json = extractJson(textBlock.text);
  const parsed = ResultSchema.parse(json);
  return { result: parsed, usage: summarizeUsage(response.usage as Usage) };
}

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? (fence[1] ?? "").trim() : text.trim();
  return JSON.parse(body);
}
