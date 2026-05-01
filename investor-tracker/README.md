# Investor Tracker

Desktop app (Electron + React + SQLite) that ingests Outlook mail and Teams chats via
Microsoft Graph and uses Claude to classify which conversations are with prospective
investors, where they sit in the pipeline, and what action items are open on either side.

## Architecture

- **Main process** (`src/main`)
  - `graph/` — Microsoft Graph auth (MSAL device-code) + mail/teams clients.
  - `claude/` — Anthropic SDK wrappers: classifier (per-sender), demand-book parser,
    thread analyzer (summary + action items + stage inference).
  - `store/` — `better-sqlite3` connection, migrations, and one repository per
    aggregate (entities, contacts, messages, action items, pending reviews, settings,
    cursors).
  - `jobs/` — background runners. `poller` pulls deltas every N minutes,
    `dailyClassifier` re-runs ambiguous classifications and ages out parked entities,
    `threadRefresher` re-summarizes recently active threads. `scheduler` drives them.
  - `ipc/handlers.ts` — typed IPC surface bound to the renderer.
  - `keychain.ts` — `keytar` wrapper for refresh tokens and the Anthropic API key.
- **Renderer** (`src/renderer`) — React app with views for Dashboard, Entities,
  Pending Review, and Settings.
- **Shared** (`src/shared`) — Zod-typed domain models and the IPC contract used by both
  sides.

## Pipeline stages

`new → initial_outreach → engaged → diligence → negotiating → committed → funded`,
with `parked` and `declined` as side states. Stage transitions are proposed by Claude
based on the latest thread evidence and require user confirmation unless the entity has
been manually overridden.

## Pending review queue

When the classifier is uncertain (confidence below `pendingReviewThreshold`, default
`0.5`) about whether a sender belongs to a tracked entity, it queues a `PendingReview`
instead of mutating state. The user confirms, rejects, or snoozes from the renderer.

## Demand book

Periodic emails from `demandBookSenderEmail` are parsed by Claude into
`DemandBookEntry` rows that the classifier consults when matching new senders to
entities. This lets us seed the entity list without manual data entry.

## Getting started

```bash
npm install
npm run rebuild   # native rebuild for better-sqlite3 against the Electron ABI
npm run dev
```

Sign in via the Settings view (device-code flow) and paste an Anthropic API key. Both
are stored in the OS keychain.
