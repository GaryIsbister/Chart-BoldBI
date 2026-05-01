import type {
  ActionItem,
  Contact,
  Entity,
  Message,
  PendingReview,
  PendingReviewDecision,
  PipelineStage,
  Settings,
  StageHistoryEntry,
  Thread,
} from "./types";

export type IpcChannel = keyof IpcContract;

export interface IpcContract {
  "auth:status": { req: void; res: { signedIn: boolean; account: string | null } };
  "auth:signIn": { req: void; res: { signedIn: boolean; account: string | null } };
  "auth:signOut": { req: void; res: { signedIn: false } };

  "settings:get": { req: void; res: Settings };
  "settings:update": { req: Partial<Settings>; res: Settings };
  "settings:setAnthropicKey": { req: { apiKey: string }; res: { ok: true } };

  "entities:list": { req: { stage?: PipelineStage } | undefined; res: Entity[] };
  "entities:get": { req: { id: string }; res: { entity: Entity; contacts: Contact[] } };
  "entities:setStage": {
    req: { id: string; stage: PipelineStage; reason?: string; parkedUntil?: string };
    res: Entity;
  };
  "entities:stageHistory": { req: { id: string }; res: StageHistoryEntry[] };

  "pendingReviews:list": { req: void; res: PendingReview[] };
  "pendingReviews:decide": {
    req: { id: string; decision: PendingReviewDecision };
    res: { id: string; decision: PendingReviewDecision };
  };

  "actionItems:list": {
    req: { entityId?: string; ownerSide?: "us" | "them"; status?: "open" | "done" } | undefined;
    res: ActionItem[];
  };
  "actionItems:setStatus": {
    req: { id: string; status: ActionItem["status"] };
    res: ActionItem;
  };

  "threads:listForEntity": { req: { entityId: string }; res: Thread[] };
  "messages:listForThread": { req: { threadId: string }; res: Message[] };

  "jobs:runPollerNow": { req: void; res: { fetched: number; newSenders: number } };
  "jobs:runDailyClassifierNow": { req: void; res: { reviewed: number; queued: number } };
  "jobs:importDemandBook": {
    req: { searchQuery?: string };
    res: { importId: string; entries: number };
  };
}

export type IpcRequest<C extends IpcChannel> = IpcContract[C]["req"];
export type IpcResponse<C extends IpcChannel> = IpcContract[C]["res"];
