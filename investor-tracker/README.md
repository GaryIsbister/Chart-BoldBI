# Investor Tracker

A desktop app (Electron + TypeScript + React) that monitors Outlook mail and Teams chats for investor communications, classifies new contacts with Claude, and groups them into entities tied to a demand-book.

> Lives alongside the unrelated Bold BI globe widget in this repo as a self-contained subdirectory. Nothing here touches the widget.

## How it works

```
Outlook (Inbox + Investors folder)  ─┐
Teams (1:1 and group chats)         ─┤→  5-min poller  ─→  SQLite store
                                                              │
              demand book PDF (manual import) ──→ Claude ─→ entities
                                                              │
                          new/uncertain contacts ─→ Claude (daily 7am) ─→ classifications
```

- **Auth**: MSAL Node interactive flow on first launch; `homeAccountId` is stored in the OS keychain (keytar). Tokens refreshed silently.
- **Polling**: every 5 minutes — Graph delta queries on `/me/mailFolders/Inbox` and the configured `Investors` folder, plus `/me/chats` listing + per-chat message paging since the last sync. Cursors persisted per-source.
- **Classifier**: scheduled daily at 7am — Claude reads new senders, groups them into entities, and uses prompt caching so the demand-book context is reused cheaply across batches.
- **Demand book import**: manual button. Searches Outlook for the configured sender's most recent PDF attachment, sends it to Claude (`document` content with `cache_control`) for entity extraction, seeds entities marked as investors.

## Project layout

```
investor-tracker/
  src/
    main/           Electron main process
      graph/        MS Graph client (mail + Teams) + MSAL auth
      claude/       Anthropic SDK wrapper, prompts, key store
      store/        SQLite (better-sqlite3) + repositories
      jobs/         5-min poller, daily classifier, demand-book importer, scheduler
      ipc/          Typed IPC bridge to the renderer
    renderer/       React + Vite UI
      src/views/    Inbox, Entities, Contacts, Threads, Settings
    shared/         Shared zod schemas + IPC contract types
```

The repository pattern in `store/repositories.ts` keeps SQLite isolated; swapping in a Postgres + REST API later only requires replacing the repos.

## Models

| Use                       | Model               |
| ------------------------- | ------------------- |
| Daily contact classifier  | `claude-sonnet-4-6` |
| Demand-book PDF parser    | `claude-opus-4-7`   |

Override in `config.local.json`.

## Setup

### 1. Azure AD app registration

You need a public-client app registration with delegated permissions:

- `Mail.Read`
- `MailboxFolder.Read`
- `Chat.Read`
- `ChatMessage.Read`
- `User.Read`
- `offline_access`

Set redirect URI: `http://localhost:8400` (public client / native).

Copy the client ID and tenant ID into your local config:

```bash
cd investor-tracker
cp config.example.json config.local.json
# edit config.local.json: set azure.clientId, azure.tenantId,
# polling.demandBookSenderEmail
```

### 2. Install

Requires Node 20+ and pnpm.

```bash
pnpm install
```

`better-sqlite3` and `keytar` are native modules — `electron-builder install-app-deps` is run by Electron's postinstall on most setups; if you hit a "wrong ELF/ABI" error at startup, run:

```bash
pnpm rebuild better-sqlite3 keytar
```

### 3. Run in dev

```bash
pnpm dev          # starts vite + tsc watch
# in another terminal:
pnpm start        # launches Electron
```

### 4. First-time use

1. Click **Sign in to Microsoft** — a browser window opens, you authenticate, and the redirect lands on `localhost:8400` to complete the flow.
2. Open **Settings** → paste your Anthropic API key. (Or set `ANTHROPIC_API_KEY` in the environment, which takes precedence.)
3. Click **Inbox → Poll now** to ingest mail and Teams chats.
4. Click **Inbox → Import latest demand book** to seed investor entities from the most recent PDF from the configured sender.
5. Click **Inbox → Run classifier now** to classify ingested contacts into entities.

After that, polling runs every 5 minutes and classification runs daily at 7am while the app is open.

## Build

```bash
pnpm build           # tsc + vite build
pnpm package         # electron-builder for current platform
```

## v1 scope

In:
- Read-only ingest of Outlook (inbox + Investors folder) and Teams 1:1/group chats
- Daily Claude classification with prompt caching
- Demand-book PDF import via Claude PDF parsing
- Manual contact-to-entity reassignment from the UI

Out (call them out and I'll add):
- Sending replies / drafting messages
- Calendar integration
- Multi-account
- Attachment OCR beyond Claude's PDF support
