import { getAccessToken } from "./auth";

const BASE = "https://graph.microsoft.com/v1.0";

export interface GraphFetchOptions extends RequestInit {
  advanced?: boolean;
}

export const graphFetch = async <T = unknown>(
  pathOrUrl: string,
  init?: GraphFetchOptions,
): Promise<T> => {
  const token = await getAccessToken();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl}`;
  const advancedHeaders: Record<string, string> = init?.advanced
    ? { ConsistencyLevel: "eventual" }
    : {};
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...advancedHeaders,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph ${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};
