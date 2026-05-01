export const uuid = (): string => globalThis.crypto.randomUUID();

export const nowIso = (): string => new Date().toISOString();

export const domainFromEmail = (email: string): string | null => {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
};
