import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export type AppConfig = {
  azure: {
    clientId: string;
    tenantId: string;
    redirectUri: string;
    scopes: string[];
  };
  claude: {
    models: { classifier: string; synthesis: string };
  };
  polling: {
    intervalMinutes: number;
    investorsFolderName: string;
    demandBookSenderEmail: string;
  };
  schedule: { dailyClassifierCron: string };
};

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const candidates = [
    path.join(app.getPath("userData"), "config.json"),
    path.resolve(process.cwd(), "config.local.json"),
    path.resolve(process.cwd(), "config.example.json"),
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      cached = JSON.parse(raw) as AppConfig;
      return cached;
    }
  }
  throw new Error(
    `No config found. Looked in: ${candidates.join(", ")}. Copy config.example.json to config.local.json and fill in values.`,
  );
}

export function dataDir(): string {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
