import { app, BrowserWindow, shell } from "electron";
import path from "path";
import { getDb, closeDb } from "./store/db";
import { registerIpcHandlers } from "./ipc/handlers";
import { GraphAuth } from "./graph/auth";
import { buildGraphClient } from "./graph/client";
import { Scheduler } from "./jobs/scheduler";
import { runPoller } from "./jobs/poller";
import { runDailyClassifier } from "./jobs/dailyClassifier";
import { SettingsRepo } from "./store/repositories/settings";

let mainWindow: BrowserWindow | null = null;
const scheduler = new Scheduler();
let auth: GraphAuth | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    title: "Investor Tracker",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
};

const bootstrapJobs = (): void => {
  if (!auth) return;
  const db = getDb();
  const settings = new SettingsRepo(db).get();

  scheduler.every(
    "graph-poller",
    settings.pollIntervalMinutes * 60 * 1000,
    async () => {
      if (!auth) return;
      const account = await auth.loadCachedAccount();
      if (!account) return; // skip until signed in
      const client = buildGraphClient(auth);
      await runPoller(db, client);
    },
  );

  scheduler.daily("daily-classifier", settings.dailyClassifierHourLocal, async () => {
    await runDailyClassifier(db);
  });
};

void app.whenReady().then(async () => {
  const db = getDb();
  const settings = new SettingsRepo(db).get();

  if (!settings.microsoftClientId) {
    console.warn(
      "[main] No Microsoft client ID configured. The Graph poller will be inactive until a client ID is set in Settings.",
    );
  }

  auth = new GraphAuth(settings.microsoftClientId ?? "REPLACE_ME", settings.microsoftTenantId);
  registerIpcHandlers({ db, auth });
  bootstrapJobs();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    scheduler.cancelAll();
    closeDb();
    app.quit();
  }
});
