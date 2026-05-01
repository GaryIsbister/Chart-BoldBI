import {
  PublicClientApplication,
  type AuthenticationResult,
  type Configuration,
  type AccountInfo,
} from "@azure/msal-node";
import { shell } from "electron";
import http from "http";
import { URL } from "url";
import { getSecret, keys, setSecret } from "../keychain";

const SCOPES = ["Mail.Read", "Chat.Read", "User.Read", "offline_access"];

const REDIRECT_PORT = 53682;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/redirect`;

export class GraphAuth {
  private pca: PublicClientApplication;
  private account: AccountInfo | null = null;

  constructor(clientId: string, tenantId: string) {
    const config: Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    };
    this.pca = new PublicClientApplication(config);
  }

  async loadCachedAccount(): Promise<AccountInfo | null> {
    const raw = await getSecret(keys.msalAccountCache);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as AccountInfo;
      this.account = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  getAccount(): AccountInfo | null {
    return this.account;
  }

  async signIn(): Promise<AccountInfo> {
    const result = await this.acquireInteractive();
    if (!result.account) throw new Error("MSAL returned no account on interactive sign-in");
    this.account = result.account;
    await setSecret(keys.msalAccountCache, JSON.stringify(result.account));
    return result.account;
  }

  async getAccessToken(): Promise<string> {
    if (!this.account) {
      const cached = await this.loadCachedAccount();
      if (!cached) throw new Error("Not signed in. Call signIn() first.");
      this.account = cached;
    }
    try {
      const silent = await this.pca.acquireTokenSilent({
        account: this.account,
        scopes: SCOPES,
      });
      if (silent?.accessToken) return silent.accessToken;
    } catch {
      // fall through to interactive
    }
    const interactive = await this.acquireInteractive();
    return interactive.accessToken;
  }

  private acquireInteractive(): Promise<AuthenticationResult> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        if (!req.url) return;
        const url = new URL(req.url, REDIRECT_URI);
        if (url.pathname !== "/redirect") {
          res.writeHead(404).end();
          return;
        }
        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400).end("Missing code");
          server.close();
          reject(new Error("No authorization code returned"));
          return;
        }
        try {
          const result = await this.pca.acquireTokenByCode({
            code,
            redirectUri: REDIRECT_URI,
            scopes: SCOPES,
          });
          res
            .writeHead(200, { "Content-Type": "text/html" })
            .end("<h1>Signed in.</h1>You can close this tab.");
          server.close();
          resolve(result);
        } catch (e) {
          res.writeHead(500).end((e as Error).message);
          server.close();
          reject(e as Error);
        }
      });

      server.listen(REDIRECT_PORT, async () => {
        const authUrl = await this.pca.getAuthCodeUrl({
          scopes: SCOPES,
          redirectUri: REDIRECT_URI,
        });
        await shell.openExternal(authUrl);
      });
    });
  }
}
