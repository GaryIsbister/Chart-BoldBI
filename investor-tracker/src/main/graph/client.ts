import "isomorphic-fetch";
import { Client } from "@microsoft/microsoft-graph-client";
import { acquireAccessToken } from "./auth";

export const graph = (): Client =>
  Client.init({
    authProvider: async (done) => {
      try {
        const token = await acquireAccessToken();
        done(null, token);
      } catch (err) {
        done(err as Error, null);
      }
    },
  });
