import type { IpcContract } from "../../../shared/ipc-channels.js";
import { getAuthStatus, signIn, signOut } from "../../graph/auth.js";

export const authHandlers = {
  "auth:status": async (): Promise<IpcContract["auth:status"]["result"]> => {
    return await getAuthStatus();
  },
  "auth:signIn": async (): Promise<IpcContract["auth:signIn"]["result"]> => {
    return await signIn();
  },
  "auth:signOut": async (): Promise<IpcContract["auth:signOut"]["result"]> => {
    return await signOut();
  },
};
