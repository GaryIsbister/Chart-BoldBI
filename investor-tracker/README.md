# Investor Tracker

Desktop app (Electron + React + TypeScript) that tracks investor conversations across Outlook + Teams via Microsoft Graph and classifies them with Claude.

## Architecture

- **Main process** (`src/main`): Microsoft Graph (MSAL device-code auth), Claude SDK, SQLite store (`better-sqlite3`), background jobs (poller, daily classifier, thread refresher).
- **Renderer** (`src/renderer`): React UI with Dashboard / Entities / Pending Review / Settings views.
- **Shared** (`src/shared`): Zod schemas, IPC channel constants, type definitions.

## Local development

```bash
npm install      # runs `electron-rebuild` post-install for native modules (better-sqlite3, keytar)
npm run dev
```

`npm run dev` starts the Vite renderer, builds the main process, and launches Electron.

### Linux requirements

`keytar` requires `libsecret`:

```bash
sudo apt-get install -y libsecret-1-0 libsecret-1-dev
```

### Environment / secrets

The app stores OAuth refresh tokens and the Anthropic API key in the OS keychain via `keytar` (service name `investor-tracker`). On first launch:

1. Open Settings, enter your Anthropic API key, click "Sign in to Microsoft".
2. Complete the device-code flow. The Graph refresh token is persisted.
3. Configure pipeline stages, watched folders, polling cadence, and the demand-book sender email.

The Microsoft client ID / tenant ID default to the values in `src/shared/types.ts` `Settings` schema and can be overridden in Settings.

## Packaging

```bash
npm run package        # build + electron-builder
npm run package:dir    # unpacked directory build (faster for testing)
```

Outputs land in `release/`.

## Schema

See `src/shared/types.ts` for the full Zod schema. SQLite migrations are in `src/main/store/migrations.ts` and run on first DB open.
