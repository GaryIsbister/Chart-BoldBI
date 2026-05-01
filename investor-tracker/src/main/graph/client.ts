import "isomorphic-fetch";
import { Client } from "@microsoft/microsoft-graph-client";
import type { GraphAuth } from "./auth";

export const buildGraphClient = (auth: GraphAuth): Client =>
  Client.init({
    authProvider: async (done) => {
      try {
        const token = await auth.getAccessToken();
        done(null, token);
      } catch (e) {
        done(e as Error, null);
      }
    },
  });
