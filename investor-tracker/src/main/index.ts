import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { loadConfig } from "./config.js";
import { registerIpcHandlers } from "./ipc/register.js";
import { initStore } from "./store/db.js";
import { startScheduler, stopScheduler } from "./jobs/scheduler.js";

const isDev = !app.isPackaged;

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "Investor Tracker",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    await win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return win;
}

app.whenReady().then(async () => {
  loadConfig();
  initStore();
  registerIpcHandlers(ipcMain);
  await createWindow();
  startScheduler();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  stopScheduler();
  if (process.platform !== "darwin") app.quit();
});
