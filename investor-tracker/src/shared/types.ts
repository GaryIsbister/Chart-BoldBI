import { z } from "zod";

export const SourceKind = z.enum(["outlook", "teams"]);
export type SourceKind = z.infer<typeof SourceKind>;

export const InvestorClassification = z.enum([
  "investor",
  "not_investor",
  "uncertain",
]);
export type InvestorClassification = z.infer<typeof InvestorClassification>;

export const Entity = z.object({
  id: z.string(),
  name: z.string(),
  domains: z.array(z.string()).default([]),
  classification: InvestorClassification,
  classificationReason: z.string().nullable().default(null),
  classifiedAt: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Entity = z.infer<typeof Entity>;

export const Contact = z.object({
  id: z.string(),
  entityId: z.string().nullable(),
  displayName: z.string(),
  email: z.string().nullable(),
  teamsUserId: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});
export type Contact = z.infer<typeof Contact>;

export const Thread = z.object({
  id: z.string(),
  source: SourceKind,
  externalId: z.string(),
  subject: z.string().nullable(),
  entityId: z.string().nullable(),
  lastMessageAt: z.string(),
  unreadCount: z.number().int().default(0),
});
export type Thread = z.infer<typeof Thread>;

export const Message = z.object({
  id: z.string(),
  threadId: z.string(),
  source: SourceKind,
  externalId: z.string(),
  fromContactId: z.string().nullable(),
  fromAddress: z.string().nullable(),
  body: z.string(),
  bodyPreview: z.string(),
  receivedAt: z.string(),
  isOutbound: z.boolean().default(false),
});
export type Message = z.infer<typeof Message>;

export const SyncCursor = z.object({
  source: SourceKind,
  scope: z.string(),
  deltaLink: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
});
export type SyncCursor = z.infer<typeof SyncCursor>;

export const AuthStatus = z.object({
  signedIn: z.boolean(),
  account: z
    .object({
      username: z.string(),
      name: z.string().nullable(),
      tenantId: z.string().nullable(),
    })
    .nullable(),
});
export type AuthStatus = z.infer<typeof AuthStatus>;

export const PollerStatus = z.object({
  running: z.boolean(),
  lastRunAt: z.string().nullable(),
  lastRunOk: z.boolean().nullable(),
  lastError: z.string().nullable(),
});
export type PollerStatus = z.infer<typeof PollerStatus>;
