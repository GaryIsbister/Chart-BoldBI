import type {
  ActionItem,
  Contact,
  Entity,
  Message,
  PendingReview,
  PendingReviewDecision,
  PipelineStage,
  Settings,
  Thread,
} from "./types";

export const IPC_CHANNELS = {
  // Settings
  SETTINGS_GET: "settings:get",
  SETTINGS_UPDATE: "settings:update",

  // Auth
  AUTH_STATUS: "auth:status",
  AUTH_SIGN_IN: "auth:signIn",
  AUTH_SIGN_OUT: "auth:signOut",
  AUTH_SET_ANTHROPIC_KEY: "auth:setAnthropicKey",
  AUTH_HAS_ANTHROPIC_KEY: "auth:hasAnthropicKey",

  // Entities
  ENTITIES_LIST: "entities:list",
  ENTITIES_GET: "entities:get",
  ENTITIES_UPDATE_STAGE: "entities:updateStage",
  ENTITIES_UPDATE_NOTES: "entities:updateNotes",

  // Contacts
  CONTACTS_LIST_FOR_ENTITY: "contacts:listForEntity",

  // Threads + messages
  THREADS_LIST_FOR_ENTITY: "threads:listForEntity",
  MESSAGES_LIST_FOR_THREAD: "messages:listForThread",

  // Action items
  ACTION_ITEMS_LIST: "actionItems:list",
  ACTION_ITEMS_UPDATE_STATUS: "actionItems:updateStatus",

  // Pending review
  PENDING_REVIEWS_LIST: "pendingReviews:list",
  PENDING_REVIEWS_DECIDE: "pendingReviews:decide",

  // Jobs
  JOBS_RUN_POLLER: "jobs:runPoller",
  JOBS_RUN_DAILY_CLASSIFIER: "jobs:runDailyClassifier",
  JOBS_RUN_POLL_AND_CLASSIFY: "jobs:runPollAndClassify",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface AuthStatus {
  microsoftSignedIn: boolean;
  microsoftAccount: string | null;
  hasAnthropicKey: boolean;
}

export interface DecidePendingReviewArgs {
  reviewId: string;
  decision: PendingReviewDecision;
  entityName?: string;
  pipelineStage?: PipelineStage;
}

export interface UpdateActionItemStatusArgs {
  id: string;
  status: ActionItem["status"];
}

export interface UpdateEntityStageArgs {
  id: string;
  stage: PipelineStage;
  reason?: string;
}

export interface UpdateEntityNotesArgs {
  id: string;
  notes: string;
}

export type {
  ActionItem,
  Contact,
  Entity,
  Message,
  PendingReview,
  Settings,
  Thread,
};
