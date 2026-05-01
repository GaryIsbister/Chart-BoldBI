# Investor Tracker — Microsoft 365 Setup (for IT)

A user at our firm wants to run a small desktop app called **Investor Tracker** on their own machine. It reads their own Outlook mail and Teams chats, and uses Claude (Anthropic API) to classify investor contacts. It does **not** send mail, does **not** modify mailboxes, and stores all data locally on the user's PC.

To allow the app to sign in, please register a public-client app in our Microsoft Entra ID (Azure AD) tenant and send the user back two values: **Tenant ID** and **Client (Application) ID**.

Estimated time: ~15 minutes.

## Steps

1. Go to **Microsoft Entra admin center** → **Identity** → **Applications** → **App registrations** → **New registration**.

2. Settings:
   - **Name:** `Investor Tracker (Desktop)`
   - **Supported account types:** *Accounts in this organizational directory only — single tenant*
   - **Redirect URI:**
     - Platform: **Public client/native (mobile & desktop)**
     - URI: `http://localhost:8400`

3. Click **Register**. On the Overview page, copy the **Application (client) ID** and **Directory (tenant) ID** — these are the two values to send back to the user.

4. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**, and add the following:

   | Permission           | What it allows                                  |
   | -------------------- | ----------------------------------------------- |
   | `Mail.Read`          | Read the signed-in user's mail                  |
   | `MailboxFolder.Read` | List the user's mail folders (e.g. "Investors") |
   | `Chat.Read`          | List the user's Teams chats                     |
   | `ChatMessage.Read`   | Read messages in those chats                    |
   | `User.Read`          | Read the signed-in user's profile               |
   | `offline_access`     | Refresh tokens silently (avoids re-prompts)     |

   All are **delegated** permissions (the app acts only as the signed-in user — it cannot read anyone else's mailbox).

5. If your tenant requires admin consent for these scopes, click **Grant admin consent for \<tenant\>**. (Most of these are user-consentable, but `Chat.Read` and `ChatMessage.Read` typically require admin consent.)

6. **Authentication** → confirm:
   - **Allow public client flows:** *Yes*
   - **Redirect URIs** include `http://localhost:8400`

That's it.

## What to send back to the user

```
Tenant ID:  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Client ID:  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Security notes

- This is a **public client** — there is no client secret. Auth is interactive only; the app cannot run unattended without a user logging in.
- Tokens are stored in the user's **Windows Credential Manager** (OS keychain). They never leave the user's machine.
- The app only reads. It has no `*.Send` or `*.Write` permissions, so it cannot send mail, post Teams messages, or modify mailbox contents.
- The Anthropic API key (used for AI classification) is the user's responsibility — they paste it into the app's Settings, and it's also stored in Credential Manager. No mail or chat content is required to leave the device for the app's basic ingest; only contact metadata + short message previews are sent to Claude during the daily classification run.
