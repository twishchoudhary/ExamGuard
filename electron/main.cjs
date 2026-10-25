const { BrowserWindow, app, ipcMain, dialog, session, shell, systemPreferences, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

let win = null;
let isExamActive = false;
let allowAppQuit = false;
let testEndTime = null;

let dirs = {};

function initStorage() {
  const userData = app.getPath("userData");
  dirs = {
    shots: path.join(userData, "athena_screenshots"),
    cam: path.join(userData, "camera_feed"),
    session: path.join(userData, "athena_exam_session.json"),
    index: path.join(userData, "athena_screenshots", "index.json"),
  };
  [dirs.shots, dirs.cam].forEach((d) => fs.existsSync(d) || fs.mkdirSync(d, { recursive: true }));
  if (!fs.existsSync(dirs.index)) writeJSON(dirs.index, []);
}

const readJSON = (file, fallback) => {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
};

async function loadApplication(targetWindow) {
  const devUrl = "http://localhost:5173/";
  const distFile = path.join(__dirname, "..", "dist", "index.html");
  const isDevRunning = await new Promise((resolve) => {
    const req = http.get(devUrl, (res) => resolve(res.statusCode < 400));
    req.on("error", () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });

  if (isDevRunning) targetWindow.loadURL(devUrl);
  else if (fs.existsSync(distFile)) targetWindow.loadFile(distFile);
  else targetWindow.loadURL(devUrl);
}

function createWindow() {
  initStorage();

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

  loadApplication(win);

  // Tab switching / Focus detection (Feature 6)
  win.on("blur", () => win && !win.isDestroyed() && win.webContents.send("window-focus-changed", { focused: false, timestamp: Date.now() }));
  win.on("focus", () => win && !win.isDestroyed() && win.webContents.send("window-focus-changed", { focused: true, timestamp: Date.now() }));

  // Fullscreen state changes (Feature 4)
  win.on("enter-full-screen", () => win && !win.isDestroyed() && win.webContents.send("fullscreen-state-change", { isFullScreen: true }));
  win.on("leave-full-screen", () => win && !win.isDestroyed() && win.webContents.send("fullscreen-state-change", { isFullScreen: false }));

  // Quit Warning (Feature 5)
  win.on("close", (e) => {
    if (isExamActive && !allowAppQuit) {
      e.preventDefault();
      win.webContents.send("quit-attempt-blocked", { timestamp: Date.now() });

      const choice = dialog.showMessageBoxSync(win, {
        type: "warning",
        title: "Athena Exam Security Warning",
        message: "An Exam is Currently in Progress!",
        detail: "Exiting during an active exam will forfeit your test submission and will be reported to the invigilator.",
        buttons: ["Stay in Exam (Recommended)", "Quit Exam Anyway"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });

      if (choice === 1) {
        allowAppQuit = true;
        isExamActive = false;
        win.close();
      }
    }
  });
}

// -------------------------------------------------------------
// IPC Handlers
// -------------------------------------------------------------

// Feature 4: Fullscreen mode
ipcMain.handle("set-fullscreen", (_, enable = true) => {
  if (win && !win.isDestroyed()) {
    win.setFullScreen(enable);
    return win.isFullScreen();
  }
  return false;
});
ipcMain.handle("is-fullscreen", () => Boolean(win && !win.isDestroyed() && win.isFullScreen()));

// Feature 5: Quit warning & exam status tracking
ipcMain.handle("set-exam-active", (_, active) => (isExamActive = Boolean(active)));

// Feature 7: Safe session recovery
ipcMain.handle("save-session", (_, sessionData) => {
  const data = { ...sessionData, lastSavedAt: Date.now() };
  return { success: writeJSON(dirs.session, data), timestamp: data.lastSavedAt };
});
ipcMain.handle("get-saved-session", () => ({ success: true, session: readJSON(dirs.session, null) }));
ipcMain.handle("clear-session", () => {
  try {
    if (fs.existsSync(dirs.session)) fs.unlinkSync(dirs.session);
  } catch {}
  return { success: true };
});

// Feature 8: Periodic screenshot capturing
ipcMain.handle("capture-screenshot", async (_, metadata = {}) => {
  if (!win || win.isDestroyed()) return { success: false, error: "Active window not found" };

  try {
    const nativeImg = await win.webContents.capturePage();
    const timestamp = Date.now();
    const reason = metadata.reason || "periodic";
    const filename = `shot_${timestamp}_${reason}.png`;
    const filePath = path.join(dirs.shots, filename);

    fs.writeFileSync(filePath, nativeImg.toPNG());

    const record = {
      id: `shot_${timestamp}`,
      filename,
      filePath,
      timestamp,
      reason,
      questionNumber: metadata.questionNumber || null,
      studentName: metadata.studentName || "User",
      thumbnail: nativeImg.resize({ width: 340 }).toDataURL(),
      reviewed: false,
      flagged: reason !== "periodic",
      notes: "",
    };

    const list = readJSON(dirs.index, []);
    list.unshift(record);
    writeJSON(dirs.index, list);

    return { success: true, screenshot: record };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Feature 9: Manual screenshot review
ipcMain.handle("get-screenshots", () => ({ success: true, screenshots: readJSON(dirs.index, []) }));

ipcMain.handle("get-screenshot-full", (_, filename) => {
  try {
    const filePath = path.join(dirs.shots, filename);
    if (fs.existsSync(filePath)) {
      return { success: true, dataUrl: `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}` };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
  return { success: false, error: "File not found" };
});

ipcMain.handle("update-screenshot", (_, { id, updates }) => {
  const list = readJSON(dirs.index, []);
  const item = list.find((s) => s.id === id);
  if (item) {
    Object.assign(item, updates);
    writeJSON(dirs.index, list);
    return { success: true, screenshot: item };
  }
  return { success: false };
});

ipcMain.handle("open-screenshots-folder", () => {
  shell.openPath(dirs.shots);
  return { success: true, path: dirs.shots };
});

// Features 1, 2, 3: Device & Permission Checks
const checkDarwinPermission = async (media) => {
  if (process.platform === "darwin") {
    try {
      const status = systemPreferences.getMediaAccessStatus(media);
      return status === "granted" || (await systemPreferences.askForMediaAccess(media));
    } catch {
      return true;
    }
  }
  return true;
};

ipcMain.handle("check-system-permissions", () => ({
  cameraStatus: process.platform === "darwin" ? systemPreferences.getMediaAccessStatus("camera") : "granted",
  micStatus: process.platform === "darwin" ? systemPreferences.getMediaAccessStatus("microphone") : "granted",
}));

ipcMain.handle("request-mic-permission", () => checkDarwinPermission("microphone"));
ipcMain.handle("request-camera-permission", () => checkDarwinPermission("camera"));

// Window controls
ipcMain.handle("window-minimize", () => win && !win.isDestroyed() && win.minimize());
ipcMain.handle("window-maximize", () => win && !win.isDestroyed() && (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.handle("window-close", () => win && !win.isDestroyed() && win.close());

// Legacy compatibility
ipcMain.handle("show-rules", async () => {
  const result = await dialog.showMessageBox(win, {
    type: "info",
    title: "Athena Secure Exam Instructions",
    message: "Candidate Rules & Proctoring Compliance",
    detail: "1. Monitoring enabled.\n2. Fullscreen mandatory.\n3. Tab switching prohibited.\n4. Screenshots recorded.\n5. Session autosaved.",
    buttons: ["I Understand & Accept", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  });
  return result.response;
});

ipcMain.handle("start-test", () => (testEndTime = Date.now() + 3600000));
ipcMain.handle("get-time", () => (!testEndTime ? 0 : Math.max(0, testEndTime - Date.now())));

ipcMain.handle("save-camera-snapshot", (_, { base64Data }) => {
  try {
    if (!base64Data) return { success: false, error: "No image data" };
    const fp = path.join(dirs.cam, `camera_${Date.now()}.png`);
    fs.writeFileSync(fp, Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), "base64"));
    return { success: true, filePath: fp };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("save-photo", (_, data) => {
  try {
    const fp = path.join(dirs.cam, `photo_${Date.now()}.png`);
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data).replace(/^data:image\/\w+;base64,/, ""), "base64");
    fs.writeFileSync(fp, buffer);
    return { success: true, filePath: fp };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// App Lifecycle
app.whenReady().then(() => {
  nativeTheme.themeSource = "dark";
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", (e) => {
  if (isExamActive && !allowAppQuit) {
    e.preventDefault();
    const choice = dialog.showMessageBoxSync({
      type: "warning",
      title: "Quit Athena Examination Alert",
      message: "Exam in Progress",
      detail: "An active examination session is still running. Quitting now will terminate your session.",
      buttons: ["Cancel", "Quit Anyway"],
      defaultId: 0,
      cancelId: 0,
    });
    if (choice === 1) {
      allowAppQuit = true;
      isExamActive = false;
      app.quit();
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
