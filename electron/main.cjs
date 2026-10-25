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
}

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
