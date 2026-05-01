import { PublicClientApplication, type AuthenticationResult } from "@azure/msal-node";
import { KEYCHAIN_KEYS, keychain } from "../keychain";
import { getSettings } from "../store/repositories/settings";

const SCOPES = [
  "Mail.Read",
  "Chat.Read",
  "User.Read",
  "offline_access",
];

interface CachedAuth {
  accessToken: string;
  expiresAt: number;
  account: string | null;
}

let cached: CachedAuth | null = null;
let pca: PublicClientApplication | null = null;

const buildClient = (): PublicClientApplication => {
  const settings = getSettings();
  const clientId = settings.microsoftClientId;
  if (!clientId) {
    throw new Error("Microsoft client ID is not configured.");
  }
  const tenantId = settings.microsoftTenantId;
  pca = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });
  return pca;
};

const ensureClient = (): PublicClientApplication => pca ?? buildClient();

export interface DeviceCodePrompt {
  userCode: string;
  verificationUri: string;
  message: string;
}

export interface SignInOptions {
  onDeviceCode: (prompt: DeviceCodePrompt) => void;
}

export const signIn = async (options: SignInOptions): Promise<{ account: string }> => {
  const client = ensureClient();
  const result = await client.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      options.onDeviceCode({
        userCode: response.userCode,
        verificationUri: response.verificationUri,
        message: response.message,
      });
    },
  });
  if (!result) {
    throw new Error("Microsoft sign-in failed: no result.");
  }
  await persistResult(result);
  const account = result.account?.username ?? "";
  if (account) {
    await keychain.set(KEYCHAIN_KEYS.MICROSOFT_ACCOUNT, account);
  }
  return { account };
};

const persistResult = async (result: AuthenticationResult): Promise<void> => {
  cached = {
    accessToken: result.accessToken,
    expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 60 * 60 * 1000,
    account: result.account?.username ?? null,
  };
  // MSAL caches its own refresh token in-memory; for persistence across launches
  // we write the token cache to keychain.
  const client = ensureClient();
  const tokenCache = client.getTokenCache().serialize();
  await keychain.set(KEYCHAIN_KEYS.MICROSOFT_REFRESH_TOKEN, tokenCache);
};

const tryHydrateFromCache = async (): Promise<void> => {
  const serialized = await keychain.get(KEYCHAIN_KEYS.MICROSOFT_REFRESH_TOKEN);
  if (!serialized) return;
  const client = ensureClient();
  await client.getTokenCache().deserialize(serialized);
};

export const getAccessToken = async (): Promise<string> => {
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.accessToken;
  }
  const client = ensureClient();
  await tryHydrateFromCache();
  const accounts = await client.getTokenCache().getAllAccounts();
  const account = accounts[0];
  if (!account) {
    throw new Error("Not signed in to Microsoft. Open Settings and sign in.");
  }
  const result = await client.acquireTokenSilent({ scopes: SCOPES, account });
  if (!result) throw new Error("Failed to acquire Microsoft access token.");
  await persistResult(result);
  return result.accessToken;
};

export const getSignedInAccount = async (): Promise<string | null> => {
  try {
    const explicit = await keychain.get(KEYCHAIN_KEYS.MICROSOFT_ACCOUNT);
    if (explicit) return explicit;
    const client = ensureClient();
    await tryHydrateFromCache();
    const accounts = await client.getTokenCache().getAllAccounts();
    return accounts[0]?.username ?? null;
  } catch {
    return null;
  }
};

export const signOut = async (): Promise<void> => {
  cached = null;
  pca = null;
  await keychain.delete(KEYCHAIN_KEYS.MICROSOFT_REFRESH_TOKEN);
  await keychain.delete(KEYCHAIN_KEYS.MICROSOFT_ACCOUNT);
};
