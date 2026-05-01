import { z } from "zod";

export const PIPELINE_STAGES = [
  "new",
  "initial_outreach",
  "engaged",
  "diligence",
  "negotiating",
  "committed",
  "funded",
  "parked",
  "declined",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PENDING_REVIEW_DECISIONS = ["confirm", "reject", "snooze"] as const;
export type PendingReviewDecision = (typeof PENDING_REVIEW_DECISIONS)[number];

export const ACTION_ITEM_OWNERS = ["us", "them"] as const;
export type ActionItemOwner = (typeof ACTION_ITEM_OWNERS)[number];

export const ACTION_ITEM_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

export const SOURCE_KINDS = ["outlook_mail", "teams_chat"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const Entity = z.object({
  id: z.string().uuid(),
  name: z.string(),
  domain: z.string().nullable(),
  pipelineStage: z.enum(PIPELINE_STAGES),
  parkedUntil: z.string().nullable(),
  stageManualOverride: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Entity = z.infer<typeof Entity>;

export const Contact = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  title: z.string().nullable(),
  createdAt: z.string(),
});
export type Contact = z.infer<typeof Contact>;

export const Message = z.object({
  id: z.string().uuid(),
  source: z.enum(SOURCE_KINDS),
  externalId: z.string(),
  threadId: z.string().nullable(),
  contactId: z.string().uuid().nullable(),
  entityId: z.string().uuid().nullable(),
  fromEmail: z.string(),
  fromName: z.string().nullable(),
  toEmails: z.array(z.string()),
  subject: z.string().nullable(),
  bodyPreview: z.string(),
  receivedAt: z.string(),
  isFromUs: z.boolean(),
  raw: z.unknown().optional(),
});
export type Message = z.infer<typeof Message>;

export const Thread = z.object({
  id: z.string().uuid(),
  externalConversationId: z.string(),
  source: z.enum(SOURCE_KINDS),
  entityId: z.string().uuid().nullable(),
  subject: z.string().nullable(),
  lastMessageAt: z.string(),
  summary: z.string().nullable(),
});
export type Thread = z.infer<typeof Thread>;

export const ActionItem = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  threadId: z.string().uuid().nullable(),
  sourceMessageId: z.string().uuid().nullable(),
  ownerSide: z.enum(ACTION_ITEM_OWNERS),
  description: z.string(),
  dueDate: z.string().nullable(),
  status: z.enum(ACTION_ITEM_STATUSES),
  resolvedAt: z.string().nullable(),
  resolvedByMessageId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ActionItem = z.infer<typeof ActionItem>;

export const PendingReview = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  domain: z.string().nullable(),
  proposedEntityName: z.string(),
  proposedEntityId: z.string().uuid().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  matchedDemandBookEntry: z.string().nullable(),
  evidenceMessageIds: z.array(z.string().uuid()),
  createdAt: z.string(),
  decision: z.enum(PENDING_REVIEW_DECISIONS).nullable(),
  decidedAt: z.string().nullable(),
});
export type PendingReview = z.infer<typeof PendingReview>;

export const StageHistoryEntry = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  fromStage: z.enum(PIPELINE_STAGES).nullable(),
  toStage: z.enum(PIPELINE_STAGES),
  changedBy: z.enum(["user", "claude"]),
  reason: z.string().nullable(),
  changedAt: z.string(),
});
export type StageHistoryEntry = z.infer<typeof StageHistoryEntry>;

export const DemandBookEntry = z.object({
  id: z.string().uuid(),
  importId: z.string().uuid(),
  entityName: z.string(),
  contactNames: z.array(z.string()),
  contactEmails: z.array(z.string()),
  ticketSize: z.string().nullable(),
  notes: z.string().nullable(),
});
export type DemandBookEntry = z.infer<typeof DemandBookEntry>;

export const Settings = z.object({
  pollIntervalMinutes: z.number().int().positive().default(5),
  watchedFolders: z.array(z.string()).default(["inbox", "Investors"]),
  pendingReviewThreshold: z.number().min(0).max(1).default(0.5),
  classifierModel: z.string().default("claude-sonnet-4-6"),
  synthesisModel: z.string().default("claude-opus-4-7"),
  microsoftClientId: z.string().nullable().default("450a1f78-1c3c-49f5-87bd-37bfc42b9068"),
  microsoftTenantId: z.string().default("common"),
  dailyClassifierHourLocal: z.number().int().min(0).max(23).default(7),
  demandBookSenderEmail: z.string().default("mg@foremostpartners.com"),
});
export type Settings = z.infer<typeof Settings>;
