import {
  PublicClientApplication,
  type AuthenticationResult,
  type Configuration,
  type AccountInfo,
} from "@azure/msal-node";
import { BrowserWindow, shell } from "electron";
import http from "node:http";
import keytar from "keytar";
import { URL } from "node:url";
import { loadConfig } from "../config.js";
import type { AuthStatus } from "../../shared/types.js";

const KEYCHAIN_SERVICE = "investor-tracker";
const KEYCHAIN_ACCOUNT_HOMEID = "msal-home-account-id";

let pca: PublicClientApplication | null = null;
let cachedAccount: AccountInfo | null = null;

function getPca(): PublicClientApplication {
  if (pca) return pca;
  const cfg = loadConfig();
  const config: Configuration = {
    auth: {
      clientId: cfg.azure.clientId,
      authority: `https://login.microsoftonline.com/${cfg.azure.tenantId}`,
    },
  };
  pca = new PublicClientApplication(config);
  return pca;
}

async function loadAccountFromKeychain(): Promise<AccountInfo | null> {
  const homeId = await keytar.getPassword(
    KEYCHAIN_SERVICE,
    KEYCHAIN_ACCOUNT_HOMEID,
  );
  if (!homeId) return null;
  const acct = await getPca().getTokenCache().getAccountByHomeId(homeId);
  return acct ?? null;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const acct = cachedAccount ?? (await loadAccountFromKeychain());
  cachedAccount = acct;
  if (!acct) return { signedIn: false, account: null };
  return {
    signedIn: true,
    account: {
      username: acct.username,
      name: acct.name ?? null,
      tenantId: acct.tenantId ?? null,
    },
  };
}

export async function getAccessToken(): Promise<string> {
  const cfg = loadConfig();
  const acct = cachedAccount ?? (await loadAccountFromKeychain());
  if (!acct) throw new Error("Not signed in");
  cachedAccount = acct;
  const result = await getPca().acquireTokenSilent({
    account: acct,
    scopes: cfg.azure.scopes,
  });
  if (!result?.accessToken) throw new Error("Silent token acquisition failed");
  return result.accessToken;
}

export async function signIn(): Promise<AuthStatus> {
  const cfg = loadConfig();
  const redirectUri = cfg.azure.redirectUri;
  const port = new URL(redirectUri).port
    ? Number(new URL(redirectUri).port)
    : 80;

  const authCodeUrlParams = {
    scopes: cfg.azure.scopes,
    redirectUri,
  };
  const url = await getPca().getAuthCodeUrl(authCodeUrlParams);

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", redirectUri);
      const codeParam = reqUrl.searchParams.get("code");
      const error = reqUrl.searchParams.get("error");
      res.statusCode = 200;
      res.setHeader("content-type", "text/html");
      res.end(
        "<html><body><h2>You can close this window.</h2></body></html>",
      );
      server.close();
      if (error) reject(new Error(error));
      else if (codeParam) resolve(codeParam);
      else reject(new Error("No code in redirect"));
    });
    server.on("error", reject);
    server.listen(port);
    void shell.openExternal(url);
  });

  const result: AuthenticationResult = await getPca().acquireTokenByCode({
    code,
    scopes: cfg.azure.scopes,
    redirectUri,
  });

  if (!result.account) throw new Error("No account returned from MSAL");
  cachedAccount = result.account;
  await keytar.setPassword(
    KEYCHAIN_SERVICE,
    KEYCHAIN_ACCOUNT_HOMEID,
    result.account.homeAccountId,
  );

  // Close any auxiliary windows that may have opened.
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.getTitle() === "auth") w.close();
  }

  return await getAuthStatus();
}

export async function signOut(): Promise<AuthStatus> {
  const acct = cachedAccount ?? (await loadAccountFromKeychain());
  if (acct) await getPca().getTokenCache().removeAccount(acct);
  cachedAccount = null;
  await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_HOMEID);
  return { signedIn: false, account: null };
}
