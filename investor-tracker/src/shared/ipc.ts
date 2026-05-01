import type {
  ActionItem,
  ActionItemStatus,
  Entity,
  PendingReview,
  PendingReviewDecision,
  PipelineStage,
  Settings,
  Thread,
} from "./types";

export const IPC = {
  authStatus: "auth:status",
  authStartDeviceCode: "auth:startDeviceCode",
  authSignOut: "auth:signOut",
  setAnthropicKey: "settings:setAnthropicKey",
  hasAnthropicKey: "settings:hasAnthropicKey",
  getSettings: "settings:get",
  updateSettings: "settings:update",
  listEntities: "entities:list",
  getEntity: "entities:get",
  setEntityStage: "entities:setStage",
  setEntityNotes: "entities:setNotes",
  parkEntity: "entities:park",
  listPendingReviews: "pendingReview:list",
  decidePendingReview: "pendingReview:decide",
  listOpenActionItems: "actionItems:listOpen",
  setActionItemStatus: "actionItems:setStatus",
  listThreadsForEntity: "threads:listForEntity",
  dashboardSummary: "dashboard:summary",
  triggerPollNow: "jobs:pollNow",
  triggerDailyClassifierNow: "jobs:dailyClassifyNow",
} as const;

export type AuthStatus = {
  signedIn: boolean;
  account: { username: string; name: string | null } | null;
};

export type DeviceCodeChallenge = {
  userCode: string;
  verificationUri: string;
  message: string;
  expiresAt: string;
};

export type DashboardSummary = {
  totalEntities: number;
  byStage: Record<PipelineStage, number>;
  pendingReviewCount: number;
  openActionItems: number;
  staleEntities: { id: string; name: string; daysSinceLastMessage: number }[];
};

export type RendererApi = {
  authStatus(): Promise<AuthStatus>;
  authStartDeviceCode(): Promise<DeviceCodeChallenge>;
  authSignOut(): Promise<void>;
  setAnthropicKey(key: string): Promise<void>;
  hasAnthropicKey(): Promise<boolean>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  listEntities(): Promise<Entity[]>;
  getEntity(id: string): Promise<Entity | null>;
  setEntityStage(id: string, stage: PipelineStage, reason: string | null): Promise<Entity>;
  setEntityNotes(id: string, notes: string | null): Promise<Entity>;
  parkEntity(id: string, until: string | null): Promise<Entity>;
  listPendingReviews(): Promise<PendingReview[]>;
  decidePendingReview(id: string, decision: PendingReviewDecision): Promise<void>;
  listOpenActionItems(): Promise<ActionItem[]>;
  setActionItemStatus(id: string, status: ActionItemStatus): Promise<ActionItem>;
  listThreadsForEntity(entityId: string): Promise<Thread[]>;
  dashboardSummary(): Promise<DashboardSummary>;
  triggerPollNow(): Promise<void>;
  triggerDailyClassifierNow(): Promise<void>;
};
