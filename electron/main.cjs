let isExamActive = false;
let allowAppQuit = false;
const { BrowserWindow, app, ipcMain, dialog, session, systemPreferences } = require("electron");
const path = require("path");

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    backgroundColor: "#f5f4f2",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(true));
  session.defaultSession.setPermissionCheckHandler(() => true);
  win.loadURL("http://localhost:5173/");
  win.on("blur", () => win && !win.isDestroyed() && win.webContents.send("window-focus-changed", { focused: false, timestamp: Date.now() }));
  win.on("focus", () => win && !win.isDestroyed() && win.webContents.send("window-focus-changed", { focused: true, timestamp: Date.now() }));

  win.on("enter-full-screen", () => win && !win.isDestroyed() && win.webContents.send("fullscreen-state-change", { isFullScreen: true }));
  win.on("leave-full-screen", () => win && !win.isDestroyed() && win.webContents.send("fullscreen-state-change", { isFullScreen: false }));
}

ipcMain.handle("check-system-permissions", () => ({
  cameraStatus: process.platform === "darwin" ? systemPreferences.getMediaAccessStatus("camera") : "granted",
  micStatus: process.platform === "darwin" ? systemPreferences.getMediaAccessStatus("microphone") : "granted",
}));

ipcMain.handle("request-mic-permission", async () => {
  if (process.platform === "darwin") {
    try {
      const status = systemPreferences.getMediaAccessStatus("microphone");
      return status === "granted" || (await systemPreferences.askForMediaAccess("microphone"));
    } catch { return true; }
  }
  return true;
});

ipcMain.handle("request-camera-permission", async () => {
  if (process.platform === "darwin") {
    try {
      const status = systemPreferences.getMediaAccessStatus("camera");
      return status === "granted" || (await systemPreferences.askForMediaAccess("camera"));
    } catch { return true; }
  }
  return true;
});

app.whenReady().then(createWindow);

ipcMain.handle("set-fullscreen", (_, enable = true) => {
  if (win && !win.isDestroyed()) {
    win.setFullScreen(enable);
    return win.isFullScreen();
  }
  return false;
});
ipcMain.handle("is-fullscreen", () => Boolean(win && !win.isDestroyed() && win.isFullScreen()));

ipcMain.handle("set-exam-active", (_, active) => (isExamActive = Boolean(active)));

ipcMain.handle("save-session", (_, sessionData) => {
  return { success: true, timestamp: Date.now() };
});
ipcMain.handle("get-saved-session", () => ({ success: true, session: null }));
ipcMain.handle("clear-session", () => ({ success: true }));

ipcMain.handle("capture-screenshot", async (_, metadata = {}) => {
  return { success: true, screenshot: { id: "shot_" + Date.now(), reason: metadata.reason || "periodic" } };
});

ipcMain.handle("get-screenshots", () => ({ success: true, screenshots: [] }));
ipcMain.handle("open-screenshots-folder", () => ({ success: true }));
