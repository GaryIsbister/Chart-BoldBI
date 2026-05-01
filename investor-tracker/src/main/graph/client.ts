import { getAccessToken } from "./auth";

const BASE = "https://graph.microsoft.com/v1.0";

export const graphFetch = async <T = unknown>(
  pathOrUrl: string,
  init?: RequestInit,
): Promise<T> => {
  const token = await getAccessToken();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
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
