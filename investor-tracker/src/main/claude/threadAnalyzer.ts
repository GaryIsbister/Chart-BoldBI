import { getClaude } from "./client";
import { getSettings } from "../store/repositories/settings";
import { listMessagesForThread, updateThreadSummary } from "../store/repositories/messages";
import { createActionItem, listOpenActionItemsForEntity, updateActionItemStatus } from "../store/repositories/actionItems";
import { updateEntityStage } from "../store/repositories/entities";
import { PIPELINE_STAGES, type PipelineStage } from "@shared/types";

export interface ThreadAnalysis {
  summary: string;
  proposedStage: PipelineStage | null;
  newActionItems: Array<{ ownerSide: "us" | "them"; description: string; dueDate: string | null }>;
  resolvedActionItemIds: string[];
}

const SYSTEM_PROMPT = `You synthesize a single investor thread into:
- A concise (<=4 sentence) summary suitable for a CRM card.
- The most appropriate pipeline stage from this set: ${PIPELINE_STAGES.join(", ")}.
- A list of new action items implied by the latest messages, with owner ("us" or "them") and an optional ISO due date.
- IDs of any previously-open action items (provided in input) that the latest messages clearly resolve.

Output JSON only:
{
  "summary": string,
  "proposed_stage": one of ${PIPELINE_STAGES.map((s) => `"${s}"`).join("|")} or null,
  "new_action_items": [{"owner": "us"|"them", "description": string, "due_date": ISO string or null}],
  "resolved_action_item_ids": [string]
}`;

const extractJson = (text: string): unknown => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`ThreadAnalyzer: no JSON in response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
};

export const analyzeThread = async (threadId: string, entityId: string): Promise<ThreadAnalysis> => {
  const claude = await getClaude();
  const settings = getSettings();
  const messages = listMessagesForThread(threadId);
  const openItems = listOpenActionItemsForEntity(entityId);

  const userPrompt = [
    "Existing open action items:",
    openItems.length > 0
      ? openItems.map((a) => `- [${a.id}] (${a.ownerSide}) ${a.description}`).join("\n")
      : "(none)",
    "",
    "Thread messages (oldest first):",
    messages
      .map(
        (m) =>
          `[${m.receivedAt}] ${m.isFromUs ? "US" : m.fromName ?? m.fromEmail}: ${m.subject ?? ""}\n${m.bodyPreview}`,
      )
      .join("\n---\n"),
  ].join("\n");

  const response = await claude.messages.create({
    model: settings.synthesisModel,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("ThreadAnalyzer: no text block");
  }
  const parsed = extractJson(textBlock.text) as {
    summary?: string;
    proposed_stage?: string | null;
    new_action_items?: Array<{ owner?: string; description?: string; due_date?: string | null }>;
    resolved_action_item_ids?: string[];
  };

  const proposedStage =
    parsed.proposed_stage && (PIPELINE_STAGES as readonly string[]).includes(parsed.proposed_stage)
      ? (parsed.proposed_stage as PipelineStage)
      : null;

  const analysis: ThreadAnalysis = {
    summary: parsed.summary ?? "",
    proposedStage,
    newActionItems: (parsed.new_action_items ?? [])
      .filter((a) => a.description && (a.owner === "us" || a.owner === "them"))
      .map((a) => ({
        ownerSide: a.owner as "us" | "them",
        description: a.description ?? "",
        dueDate: a.due_date ?? null,
      })),
    resolvedActionItemIds: parsed.resolved_action_item_ids ?? [],
  };

  return analysis;
};

export const applyAnalysis = (
  threadId: string,
  entityId: string,
  analysis: ThreadAnalysis,
): void => {
  updateThreadSummary(threadId, analysis.summary);

  if (analysis.proposedStage) {
    updateEntityStage({
      id: entityId,
      stage: analysis.proposedStage,
      changedBy: "claude",
      reason: "thread analysis",
    });
  }

  for (const item of analysis.newActionItems) {
    createActionItem({
      entityId,
      threadId,
      sourceMessageId: null,
      ownerSide: item.ownerSide,
      description: item.description,
      dueDate: item.dueDate ?? null,
    });
  }
  for (const id of analysis.resolvedActionItemIds) {
    updateActionItemStatus(id, "done", null);
  }
};
