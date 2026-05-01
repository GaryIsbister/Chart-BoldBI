import { z } from "zod";
import { PIPELINE_STAGES, type PipelineStage } from "@shared/types";
import { getAnthropic } from "./client";

const Suggestion = z.object({
  proposedStage: z.enum(PIPELINE_STAGES),
  stageReason: z.string(),
  summary: z.string(),
  actionItems: z
    .array(
      z.object({
        ownerSide: z.enum(["us", "them"]),
        description: z.string(),
        dueDate: z.string().nullable().default(null),
      }),
    )
    .default([]),
  resolvedActionItemDescriptions: z.array(z.string()).default([]),
});
export type ThreadAnalysis = z.infer<typeof Suggestion>;

export type AnalyzeInput = {
  entityName: string;
  currentStage: PipelineStage;
  manualOverride: boolean;
  messages: {
    direction: "from_us" | "from_them";
    fromName: string | null;
    fromEmail: string;
    receivedAt: string;
    subject: string | null;
    bodyPreview: string;
  }[];
  openActionItems: { id: string; ownerSide: "us" | "them"; description: string }[];
  model: string;
};

const SYSTEM = `You are analyzing one investor conversation thread to (a) summarize the latest state, (b) propose a pipeline stage, and (c) identify action items on either side.

Pipeline stages, in order:
- new: we have not engaged yet
- initial_outreach: an intro email/ping has been sent or received, no substantive reply
- engaged: substantive back-and-forth happening
- diligence: they are asking for deck/data room/diligence materials
- negotiating: term sheet, allocation, side letter discussions
- committed: verbal or written commitment to invest
- funded: subscription docs signed and/or wire received
- parked: explicitly paused (timing or process), not declined
- declined: explicit no

Return strictly JSON:
{
  "proposedStage": one of the stages above,
  "stageReason": "1-2 sentence justification citing latest message evidence",
  "summary": "3-5 sentence neutral summary of the thread state",
  "actionItems": [
    { "ownerSide": "us" | "them", "description": string, "dueDate": ISO date or null }
  ],
  "resolvedActionItemDescriptions": [string]   // descriptions of previously-open items that the latest messages have completed
}

If manualOverride is true, you may still propose a stage but the caller will not auto-apply it.`;

const tryParseJson = (text: string): unknown => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`no JSON object in thread analyzer response: ${text}`);
  return JSON.parse(match[0]);
};

export const analyzeThread = async (
  input: AnalyzeInput,
): Promise<ThreadAnalysis> => {
  const messageLines = input.messages
    .slice(-30)
    .map(
      (m) =>
        `[${m.receivedAt}] ${m.direction === "from_us" ? "(us)" : `(${m.fromName ?? m.fromEmail})`}\nsubject: ${m.subject ?? "(none)"}\n${m.bodyPreview.slice(0, 1500)}`,
    )
    .join("\n---\n");
  const openLines = input.openActionItems
    .map((a) => `- [${a.ownerSide}] ${a.description}`)
    .join("\n");
  const prompt = `Entity: ${input.entityName}
Current stage: ${input.currentStage}
Manual override active: ${input.manualOverride}

Open action items:
${openLines || "(none)"}

Messages (oldest first, most recent last):
${messageLines || "(none)"}

Return JSON only.`;

  const client = await getAnthropic();
  const resp = await client.messages.create({
    model: input.model,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const text = resp.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n");
  return Suggestion.parse(tryParseJson(text));
};
