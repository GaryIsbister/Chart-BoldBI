import path from "node:path";
import { app, BrowserWindow } from "electron";
import { getDb, closeDb } from "./store/db";
import { registerIpcHandlers } from "./ipc/handlers";
import { startScheduler, stopScheduler } from "./jobs/scheduler";

let mainWindow: BrowserWindow | null = null;

const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  return win;
};

const initialize = (): void => {
  getDb();
  registerIpcHandlers(() => mainWindow);
  mainWindow = createWindow();
  startScheduler();
};

app.whenReady().then(() => {
  initialize();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopScheduler();
  closeDb();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopScheduler();
  closeDb();
});
