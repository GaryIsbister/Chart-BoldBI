import keytar from "keytar";

const SERVICE = "investor-tracker";
const ACCOUNT = "anthropic-api-key";

export async function getClaudeKey(): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  return await keytar.getPassword(SERVICE, ACCOUNT);
}

export async function hasClaudeKey(): Promise<boolean> {
  return (await getClaudeKey()) !== null;
}

export async function setClaudeKey(key: string): Promise<void> {
  await keytar.setPassword(SERVICE, ACCOUNT, key);
}

export async function clearClaudeKey(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
