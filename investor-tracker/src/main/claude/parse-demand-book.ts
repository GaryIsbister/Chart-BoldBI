import { z } from "zod";
import { loadConfig } from "../config.js";
import { getAnthropic, summarizeUsage, type Usage } from "./client.js";
import { DEMAND_BOOK_PARSER_SYSTEM } from "./prompts.js";

const SchemaPDF = z.object({
  entities: z.array(
    z.object({
      name: z.string(),
      domains: z.array(z.string()).default([]),
      status: z.string().nullable(),
      contacts: z.array(z.string()).default([]),
    }),
  ),
});

export type DemandBookParseResult = z.infer<typeof SchemaPDF>;

export async function parseDemandBookPdf(
  pdfBytes: Buffer,
  filename: string,
): Promise<{
  result: DemandBookParseResult;
  usage: ReturnType<typeof summarizeUsage>;
}> {
  const cfg = loadConfig();
  const client = await getAnthropic();
  const base64 = pdfBytes.toString("base64");

  const response = await client.messages.create({
    model: cfg.claude.models.synthesis,
    max_tokens: 8000,
    system: DEMAND_BOOK_PARSER_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: `Filename: ${filename}\n\nReturn JSON: { "entities": [ { "name", "domains": [], "status", "contacts": [] } ] }`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Demand book parser returned no text");
  }
  const fence = textBlock.text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? (fence[1] ?? "").trim() : textBlock.text.trim();
  const parsed = SchemaPDF.parse(JSON.parse(body));
  return { result: parsed, usage: summarizeUsage(response.usage as Usage) };
}
