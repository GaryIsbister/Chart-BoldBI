import "isomorphic-fetch";
import { Client } from "@microsoft/microsoft-graph-client";
import { getAccessToken } from "./auth.js";

export function getGraphClient(): Client {
  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await getAccessToken();
        done(null, token);
      } catch (e) {
        done(e as Error, null);
      }
    },
    defaultVersion: "v1.0",
  });
}
