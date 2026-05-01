# Investor Tracker — How to Install and Run

This is for **you**, the end user. No coding required.

## What you need before you start

1. **Tenant ID** and **Client ID** from your IT admin. (They follow [`docs/IT-SETUP.md`](IT-SETUP.md). It's a 15-minute task on their end.)
2. **Anthropic API key** — sign up at <https://console.anthropic.com>, add billing, create an API key. You can do this without IT.
3. A **Windows 10 or 11** PC.

## Step 1 — Download the installer

Each time the app is updated, GitHub builds a fresh Windows installer.

1. Go to <https://github.com/garyisbister/chart-boldbi/actions>
2. Click the most recent successful **"Build Investor Tracker (Windows)"** run (green checkmark on the left).
3. Scroll to the bottom of the page → **Artifacts** section → click **InvestorTracker-Windows-Installer** to download a `.zip`.
4. Open the zip. Inside is a file called something like `Investor Tracker Setup 0.1.0.exe`. Drag it to your Desktop.

## Step 2 — Get the Tenant ID and Client ID into the app

> *This step only needs to be done once. The values can be baked into the app at build time so you never have to enter them again.*

For now, ask whoever set up this project to add your Tenant ID and Client ID into `investor-tracker/config.example.json` and push. GitHub will rebuild the installer automatically. Then re-download from the link in Step 1.

(A future version will let you paste these directly into the app's Settings screen — flag if that's important.)

## Step 3 — Run the installer

1. Double-click `Investor Tracker Setup 0.1.0.exe`.
2. **Windows will warn you:** *"Windows protected your PC"* (because the app isn't code-signed). This is normal.
   - Click **More info** → **Run anyway**.
3. Follow the installer prompts. By default it creates a Desktop shortcut.

## Step 4 — First run

1. Double-click the **Investor Tracker** shortcut on your desktop.
2. Click **Sign in to Microsoft** in the top bar. A browser window opens — log in with your work account and approve the permissions. The browser will say "You can close this window" when it's done.
3. Click the **Settings** tab → paste your Anthropic API key → **Save**.
4. Click the **Inbox** tab → **Poll now** to do a first sync of your mail and Teams chats.
5. Click **Import latest demand book** to seed investor entities from the most recent demand-book PDF (the app looks for the most recent PDF attachment from the email address configured in the app — typically Marina's address).
6. Click **Run classifier now** to have Claude classify the contacts you've ingested.

After this first run, the app does everything automatically while it's open: polling every 5 minutes, classifying daily at 7am.

## Where the data lives

Everything is stored on **your PC only**:

- Tokens & API key: Windows Credential Manager
- Mail/chat cache and entities: `%APPDATA%\Investor Tracker\data\investor-tracker.sqlite`

Uninstalling from Windows → Settings → Apps removes the app. To wipe data, delete the `%APPDATA%\Investor Tracker` folder.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Windows protected your PC" | Click **More info → Run anyway** (one-time). |
| Sign-in opens browser but nothing comes back | Make sure no other app is using port 8400. Try again. |
| "Not signed in" / classifier won't run | Check the top bar — sign in if needed. |
| "Anthropic API key not set" | Settings tab → paste your key → Save. |
| Classifier returns 0 | Run **Poll now** first to ingest mail/chats. |

If something else breaks, screenshot the error and send it to whoever set this up.
