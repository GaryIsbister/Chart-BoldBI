import { getClaude } from "./client";
import { getSettings } from "../store/repositories/settings";
import {
  getThreadLastAnalyzedAt,
  listMessagesForThread,
  setThreadLastAnalyzedAt,
  updateThreadSummary,
} from "../store/repositories/messages";
import {
  createActionItem,
  listOpenActionItemsForEntity,
  updateActionItemStatus,
} from "../store/repositories/actionItems";
import { updateEntityStage } from "../store/repositories/entities";
import { nowIso } from "@shared/util";
import { PIPELINE_STAGES, type Message, type PipelineStage } from "@shared/types";

export interface ThreadAnalysis {
  summary: string;
  proposedStage: PipelineStage | null;
  newActionItems: Array<{
    ownerSide: "us" | "them";
    description: string;
    dueDate: string | null;
  }>;
  resolvedActionItemIds: string[];
  hadNewMessages: boolean;
  latestMessageId: string | null;
  latestMessageReceivedAt: string | null;
}

const SYSTEM_PROMPT = `You synthesize a single investor email thread.

You will receive:
- A list of currently open action items (with IDs).
- (Optional) "Earlier thread context" — messages already processed in a previous run. DO NOT generate new action items from these. They are background only.
- "New messages to analyze" — messages received since the last run. Generate new action items ONLY from these.

Tasks:
- Summarize the whole thread (use both old and new context) in <=4 sentences for a CRM card.
- Pick the most appropriate pipeline stage based on the current state: ${PIPELINE_STAGES.join(", ")}.
- Extract any new action items implied by the NEW messages, each with owner ("us" or "them") and an optional ISO due date. Do NOT repeat any existing open action items.
- List IDs of existing open action items that the new messages clearly resolve.

If there are no new messages, return empty new_action_items and resolved_action_item_ids; only the summary and proposed_stage may be updated.

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

const renderMessage = (m: Message): string =>
  `[${m.receivedAt}] ${m.isFromUs ? "US" : m.fromName ?? m.fromEmail}: ${m.subject ?? ""}\n${m.bodyPreview}`;

export const analyzeThread = async (
  threadId: string,
  entityId: string,
): Promise<ThreadAnalysis> => {
  const claude = await getClaude();
  const settings = getSettings();
  const allMessages = listMessagesForThread(threadId);
  const openItems = listOpenActionItemsForEntity(entityId);
  const lastAnalyzedAt = getThreadLastAnalyzedAt(threadId);

  const oldMessages = lastAnalyzedAt
    ? allMessages.filter((m) => m.receivedAt <= lastAnalyzedAt)
    : [];
  const newMessages = lastAnalyzedAt
    ? allMessages.filter((m) => m.receivedAt > lastAnalyzedAt)
    : allMessages;

  const latestMessage = allMessages[allMessages.length - 1] ?? null;

  if (newMessages.length === 0) {
    return {
      summary: "",
      proposedStage: null,
      newActionItems: [],
      resolvedActionItemIds: [],
      hadNewMessages: false,
      latestMessageId: latestMessage?.id ?? null,
      latestMessageReceivedAt: latestMessage?.receivedAt ?? null,
    };
  }

  const sections: string[] = [
    "Existing open action items:",
    openItems.length > 0
      ? openItems
          .map((a) => `- [${a.id}] (${a.ownerSide}) ${a.description}`)
          .join("\n")
      : "(none)",
    "",
  ];

  if (oldMessages.length > 0) {
    sections.push(
      "Earlier thread context (DO NOT generate action items from these — background only):",
      oldMessages.map(renderMessage).join("\n---\n"),
      "",
    );
  }

  sections.push(
    "New messages to analyze (generate action items from these only):",
    newMessages.map(renderMessage).join("\n---\n"),
  );

  const userPrompt = sections.join("\n");

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
    new_action_items?: Array<{
      owner?: string;
      description?: string;
      due_date?: string | null;
    }>;
    resolved_action_item_ids?: string[];
  };

  const proposedStage =
    parsed.proposed_stage &&
    (PIPELINE_STAGES as readonly string[]).includes(parsed.proposed_stage)
      ? (parsed.proposed_stage as PipelineStage)
      : null;

  return {
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
    hadNewMessages: true,
    latestMessageId: latestMessage?.id ?? null,
    latestMessageReceivedAt: latestMessage?.receivedAt ?? null,
  };
};

export const applyAnalysis = (
  threadId: string,
  entityId: string,
  analysis: ThreadAnalysis,
): void => {
  if (analysis.summary) {
    updateThreadSummary(threadId, analysis.summary);
  }

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
      sourceMessageId: analysis.latestMessageId,
      ownerSide: item.ownerSide,
      description: item.description,
      dueDate: item.dueDate ?? null,
    });
  }
  for (const id of analysis.resolvedActionItemIds) {
    updateActionItemStatus(id, "done", null);
  }

  // Advance the analysis cursor: anything received up to the latest message
  // we have is now "processed" and won't generate duplicate actions next run.
  setThreadLastAnalyzedAt(
    threadId,
    analysis.latestMessageReceivedAt ?? nowIso(),
  );
};
