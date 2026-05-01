# Investor Tracker

Desktop app that tracks all communications with investors and risk participants
across Outlook (mail) and Microsoft Teams (1:1 and group chats), using Claude to:

- Identify likely-investor senders from new email addresses (with a confirmation queue)
- Maintain pipeline stage per entity (`new → initial_outreach → engaged → diligence → negotiating → committed → funded`, plus `parked` and `declined`)
- Extract outstanding action items in both directions (we owe / they owe), auto-resolving when a later message satisfies them
- Summarize threads on each poll

Architecture: Electron + TypeScript + React (Vite), SQLite (better-sqlite3),
Microsoft Graph (MSAL Node), Anthropic SDK.

## Repo layout

```
investor-tracker/
  src/
    main/            Electron main process
      graph/         MSAL auth + Microsoft Graph mail and Teams clients
      claude/        Anthropic client, classifier, thread analyzer, demand-book parser
      store/         SQLite schema + repositories
      jobs/          5-min poller, daily classifier, thread refresher, scheduler
      ipc/           Typed IPC handlers
    renderer/        React UI (Dashboard, Pending Review, Entities, Settings)
    shared/          Types, Zod schemas, IPC contract
  electron.vite.config.ts
  package.json
```

## Setup

1. `cd investor-tracker && npm install`
2. Register an Azure AD app: public client with redirect URI `http://localhost:53682/redirect`,
   delegated permissions `Mail.Read`, `Chat.Read`, `User.Read`, `offline_access`.
3. `npm run dev`
4. In **Settings**, paste the Azure AD client ID, then **Sign in with Microsoft**.
5. Paste an Anthropic API key (stored in the OS keychain via `keytar`).
6. Click **Import latest demand book** to seed the classifier with Marina's investor list.

## Models

- Daily sender classification: **Sonnet 4.6** (`claude-sonnet-4-6`)
- Thread analysis (stage + action items) and demand-book parsing: **Opus 4.7** (`claude-opus-4-7`) with adaptive thinking

The demand-book context is sent as a cached system block, so the per-call cost
of classifying senders against it stays small.

## Background jobs

- **Poller** runs every `pollIntervalMinutes` (default 5). Uses Graph delta queries
  on the inbox + each watched folder, tracking a per-source cursor in `poll_cursors`.
- **Daily classifier** runs at `dailyClassifierHourLocal` (default 7am). Looks at
  external senders from the last ~36h whose address has never been seen and isn't
  ignored, runs the classifier, and queues those scoring above
  `pendingReviewThreshold` (default 0.5) into the **Pending Review** view.

## Sharing with a team later

The data layer is a thin repository abstraction over SQLite. To move to a shared
backend, replace `src/main/store/repositories/*.ts` with calls into a Postgres
service and add an HTTP transport in front of the existing IPC contract — the
renderer doesn't need to change.

## Status

Scaffold. The structure, data model, IPC contract, scheduler, poller, classifier,
thread analyzer, and UI shell are in place. Two pieces are stubs awaiting work:

- **Demand-book attachment ingest** (`jobs:importDemandBook`): currently a no-op;
  the Outlook search + attachment download + PDF/DOCX text extraction need to be
  wired into the existing `parseDemandBook` Claude call.
- **Per-thread refresh schedule**: `refreshEntityThreads` exists but isn't yet
  hooked into the post-poll job; add a call once the poller learns to track which
  entities had new messages this tick.
