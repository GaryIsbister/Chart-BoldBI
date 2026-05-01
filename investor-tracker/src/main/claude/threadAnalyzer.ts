import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getClaude, MODELS } from "./client";
import type { Message, PipelineStage } from "@shared/types";
import { PIPELINE_STAGES } from "@shared/types";

export const ThreadAnalysis = z.object({
  summary: z.string(),
  inferredStage: z.enum(PIPELINE_STAGES),
  stageRationale: z.string(),
  parkedUntil: z.string().nullable(),
  actionItems: z.array(
    z.object({
      ownerSide: z.enum(["us", "them"]),
      description: z.string(),
      dueDate: z.string().nullable(),
      sourceMessageExternalId: z.string().nullable(),
      resolvedByMessageExternalId: z.string().nullable(),
      status: z.enum(["open", "in_progress", "done"]),
    }),
  ),
});
export type ThreadAnalysis = z.infer<typeof ThreadAnalysis>;

const SYSTEM = `You analyze an email/Teams thread between us (the trade-finance fund) and a potential or existing investor.

Produce a structured analysis covering:
1. summary: 2-4 sentence summary of the thread state.
2. inferredStage: pick from [${PIPELINE_STAGES.join(", ")}].
   - "new": no contact yet
   - "initial_outreach": we reached out, no engagement
   - "engaged": active back-and-forth, exploring fit
   - "diligence": they are reviewing materials / asking diligence questions
   - "negotiating": discussing terms, ticket size, docs
   - "committed": they have committed verbally or in writing
   - "funded": they have wired
   - "parked": waiting for an event (new vintage, board meeting, internal approval); set parkedUntil
   - "declined": passed
3. stageRationale: 1-2 sentences quoting the strongest evidence.
4. parkedUntil: ISO date string only when stage is "parked", else null.
5. actionItems: open or recently-resolved commitments across the thread.
   - ownerSide: "us" if we owe them something, "them" if they owe us.
   - description: short, imperative ("Send Q3 portfolio report", "Confirm ticket size").
   - dueDate: ISO date if explicit; else null.
   - sourceMessageExternalId: the externalId of the message that created the obligation, if identifiable.
   - resolvedByMessageExternalId: only if a later message clearly fulfilled the action; else null.
   - status: "done" only if resolvedByMessageExternalId is set; "in_progress" if partially handled; else "open".

Return JSON only.`;

export const analyzeThread = async (
  threadSubject: string | null,
  messages: Message[],
): Promise<ThreadAnalysis> => {
  const client = await getClaude();
  const transcript = messages
    .map(
      (m) =>
        `[${m.receivedAt}] externalId=${m.externalId} from=${m.fromEmail} (${m.isFromUs ? "us" : "them"})\nsubject: ${m.subject ?? ""}\n${m.bodyPreview}`,
    )
    .join("\n---\n");

  const response = await client.messages.create({
    model: MODELS.synthesis,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Thread subject: ${threadSubject ?? "(none)"}\n\nTranscript (oldest first):\n${transcript}\n\nReturn strict JSON only.`,
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
    throw new Error(`Thread analysis returned non-JSON: ${text.slice(0, 200)}`);
  }
  return ThreadAnalysis.parse(JSON.parse(text.slice(start, end + 1)));
};

// Helper to coerce inferredStage to PipelineStage at the boundary
export const stageFromAnalysis = (a: ThreadAnalysis): PipelineStage => a.inferredStage;
