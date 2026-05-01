import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { closeDb, getDb } from "./store/db";
import { SettingsRepo } from "./store/repositories/settings";
import { initAuth, getAccount } from "./graph/auth";
import { registerIpcHandlers } from "./ipc/handlers";
import { startScheduler, stopScheduler } from "./jobs/scheduler";

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
};

const bootstrap = async (): Promise<void> => {
  getDb();
  const settings = new SettingsRepo(getDb()).get();
  if (settings.microsoftClientId) {
    initAuth(settings.microsoftClientId, settings.microsoftTenantId);
    const account = await getAccount();
    if (account) startScheduler();
  }
  registerIpcHandlers();
  createWindow();
};

app.whenReady().then(() => {
  void bootstrap();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopScheduler();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopScheduler();
  closeDb();
});
