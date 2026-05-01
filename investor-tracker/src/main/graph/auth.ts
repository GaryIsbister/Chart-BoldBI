import {
  PublicClientApplication,
  type AuthenticationResult,
  type Configuration,
  type AccountInfo,
} from "@azure/msal-node";
import type { DeviceCodeChallenge } from "@shared/ipc";
import { keychain, KeychainAccount } from "../keychain";

const SCOPES = [
  "User.Read",
  "Mail.Read",
  "Chat.Read",
  "ChatMessage.Read",
  "offline_access",
];

let pca: PublicClientApplication | null = null;
let cachedAccount: AccountInfo | null = null;

const buildConfig = (clientId: string, tenantId: string): Configuration => ({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
  },
  cache: {
    cachePlugin: {
      async beforeCacheAccess(ctx) {
        const data = await keychain.get(KeychainAccount.msalCache);
        if (data) ctx.tokenCache.deserialize(data);
      },
      async afterCacheAccess(ctx) {
        if (ctx.cacheHasChanged) {
          await keychain.set(
            KeychainAccount.msalCache,
            ctx.tokenCache.serialize(),
          );
        }
      },
    },
  },
});

export const initAuth = (clientId: string, tenantId: string): void => {
  pca = new PublicClientApplication(buildConfig(clientId, tenantId));
};

const ensure = (): PublicClientApplication => {
  if (!pca) throw new Error("auth not initialized; call initAuth first");
  return pca;
};

export const getAccount = async (): Promise<AccountInfo | null> => {
  if (cachedAccount) return cachedAccount;
  const accounts = await ensure().getTokenCache().getAllAccounts();
  cachedAccount = accounts[0] ?? null;
  return cachedAccount;
};

export const startDeviceCode = (
  onChallenge: (c: DeviceCodeChallenge) => void,
): Promise<AuthenticationResult | null> =>
  ensure().acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (resp) => {
      onChallenge({
        userCode: resp.userCode,
        verificationUri: resp.verificationUri,
        message: resp.message,
        expiresAt: new Date(Date.now() + resp.expiresIn * 1000).toISOString(),
      });
    },
  }).then((result) => {
    cachedAccount = result?.account ?? null;
    return result;
  });

export const acquireAccessToken = async (): Promise<string> => {
  const app = ensure();
  const account = await getAccount();
  if (!account) throw new Error("not signed in");
  const result = await app.acquireTokenSilent({ scopes: SCOPES, account });
  if (!result) throw new Error("failed to acquire token");
  return result.accessToken;
};

export const signOut = async (): Promise<void> => {
  const app = ensure();
  const account = await getAccount();
  if (account) await app.getTokenCache().removeAccount(account);
  cachedAccount = null;
  await keychain.delete(KeychainAccount.msalCache);
};
