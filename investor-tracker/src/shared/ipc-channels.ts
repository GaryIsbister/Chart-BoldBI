import type {
  AuthStatus,
  Contact,
  Entity,
  Message,
  PollerStatus,
  Thread,
} from "./types.js";

export type IpcContract = {
  "auth:status": { args: []; result: AuthStatus };
  "auth:signIn": { args: []; result: AuthStatus };
  "auth:signOut": { args: []; result: AuthStatus };

  "entities:list": { args: [{ classification?: string }?]; result: Entity[] };
  "entities:get": { args: [string]; result: Entity | null };
  "entities:setClassification": {
    args: [{ id: string; classification: string; reason?: string }];
    result: Entity;
  };

  "contacts:list": { args: [{ entityId?: string }?]; result: Contact[] };
  "contacts:assignToEntity": {
    args: [{ contactId: string; entityId: string | null }];
    result: Contact;
  };

  "threads:list": { args: [{ entityId?: string }?]; result: Thread[] };
  "threads:messages": { args: [string]; result: Message[] };

  "jobs:pollNow": { args: []; result: PollerStatus };
  "jobs:classifyNow": { args: []; result: { classified: number } };
  "jobs:importDemandBook": {
    args: [];
    result: { imported: number; entitiesAdded: number };
  };
  "jobs:status": { args: []; result: PollerStatus };

  "settings:getClaudeKeyPresent": { args: []; result: boolean };
  "settings:setClaudeKey": { args: [string]; result: void };
};

export type IpcChannel = keyof IpcContract;
