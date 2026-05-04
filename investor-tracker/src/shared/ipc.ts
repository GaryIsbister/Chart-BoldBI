import type {
  ActionItem,
  Contact,
  Entity,
  EntityCategory,
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
  ENTITIES_CREATE: "entities:create",
  ENTITIES_UPDATE_STAGE: "entities:updateStage",
  ENTITIES_UPDATE_NOTES: "entities:updateNotes",
  ENTITIES_UPDATE_CATEGORY: "entities:updateCategory",
  ENTITIES_UPDATE_USE_DOMAIN: "entities:updateUseDomain",

  // Contacts
  CONTACTS_LIST_FOR_ENTITY: "contacts:listForEntity",
  CONTACTS_CREATE: "contacts:create",
  CONTACTS_FIND_BY_NAME: "contacts:findByName",
  MAIL_SEARCH_SENDERS: "mail:searchSenders",

  // Threads + messages
  THREADS_LIST_FOR_ENTITY: "threads:listForEntity",
  MESSAGES_LIST_FOR_THREAD: "messages:listForThread",

  // Action items
  ACTION_ITEMS_LIST: "actionItems:list",
  ACTION_ITEMS_UPDATE_STATUS: "actionItems:updateStatus",
  ACTION_ITEMS_UPDATE_DUE_DATE: "actionItems:updateDueDate",
  ACTION_ITEMS_CREATE: "actionItems:create",

  // Pending review
  PENDING_REVIEWS_LIST: "pendingReviews:list",
  PENDING_REVIEWS_DECIDE: "pendingReviews:decide",
  PENDING_REVIEWS_LIST_REJECTED: "pendingReviews:listRejected",
  PENDING_REVIEWS_REOPEN: "pendingReviews:reopen",

  // Jobs
  JOBS_RUN_POLLER: "jobs:runPoller",
  JOBS_RUN_DAILY_CLASSIFIER: "jobs:runDailyClassifier",
  JOBS_RUN_POLL_AND_CLASSIFY: "jobs:runPollAndClassify",
  JOBS_REFRESH_ENTITY_THREADS: "jobs:refreshEntityThreads",
  JOBS_BACKFILL_MAIL: "jobs:backfillMail",
  JOBS_BACKFILL_FOR_INVESTOR: "jobs:backfillForInvestor",
  JOBS_CHECK_NEW_EMAILS: "jobs:checkNewEmails",
  MESSAGES_MARK_ENTITY_READ: "messages:markEntityRead",
  MESSAGES_TOGGLE_READ: "messages:toggleRead",
  MESSAGES_NEW_COUNTS: "messages:newCounts",
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

export interface CreateActionItemArgs {
  entityId: string;
  description: string;
  ownerSide: ActionItem["ownerSide"];
  dueDate?: string | null;
}

export interface UpdateActionItemDueDateArgs {
  id: string;
  dueDate: string | null;
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

export interface CreateEntityArgs {
  name: string;
  domain?: string | null;
  useDomainMatching?: boolean;
  pipelineStage?: PipelineStage;
  category?: EntityCategory;
  notes?: string | null;
  contactEmails?: string[];
}

export interface UpdateEntityCategoryArgs {
  id: string;
  category: EntityCategory;
}

export interface UpdateEntityUseDomainArgs {
  id: string;
  useDomainMatching: boolean;
}

export interface CreateContactArgs {
  entityId: string;
  email: string;
  displayName?: string | null;
  title?: string | null;
}

export interface SenderCandidate {
  email: string;
  displayName: string | null;
  messageCount: number;
  lastSeen: string;
}

export interface SearchSendersArgs {
  query: string;
  monthsBack: number;
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
