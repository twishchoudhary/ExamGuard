const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Feature 4: Fullscreen mode
  setFullScreen: (enable = true) => ipcRenderer.invoke("set-fullscreen", enable),
  isFullScreen: () => ipcRenderer.invoke("is-fullscreen"),
  onFullScreenChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("fullscreen-state-change", handler);
    return () => ipcRenderer.removeListener("fullscreen-state-change", handler);
  },

  // Feature 5: Quit warning & exam status
  setExamActive: (active) => ipcRenderer.invoke("set-exam-active", active),
  onQuitAttemptBlocked: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("quit-attempt-blocked", handler);
    return () => ipcRenderer.removeListener("quit-attempt-blocked", handler);
  },

  // Feature 6: Tab switching & focus loss detection
  onWindowFocusChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("window-focus-changed", handler);
    return () => ipcRenderer.removeListener("window-focus-changed", handler);
  },

  // Feature 7: Safe session recovery
  saveSession: (sessionData) => ipcRenderer.invoke("save-session", sessionData),
  getSavedSession: () => ipcRenderer.invoke("get-saved-session"),
  clearSession: () => ipcRenderer.invoke("clear-session"),

  // Feature 8: Periodic screenshot capturing
  captureScreenshot: (metadata) => ipcRenderer.invoke("capture-screenshot", metadata),
  saveCameraSnapshot: (data) => ipcRenderer.invoke("save-camera-snapshot", data),

  // Feature 9: Manual screenshot review
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  getScreenshotFull: (filename) => ipcRenderer.invoke("get-screenshot-full", filename),
  updateScreenshot: (data) => ipcRenderer.invoke("update-screenshot", data),
  openScreenshotsFolder: () => ipcRenderer.invoke("open-screenshots-folder"),

  // Device & System checks (Features 1, 2, 3)
  checkSystemPermissions: () => ipcRenderer.invoke("check-system-permissions"),
  requestMicPermission: () => ipcRenderer.invoke("request-mic-permission"),
  requestCameraPermission: () => ipcRenderer.invoke("request-camera-permission"),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window-maximize"),
  closeWindow: () => ipcRenderer.invoke("window-close"),

  // Rules and Legacy support
  showRules: () => ipcRenderer.invoke("show-rules"),
  showExamRules: () => ipcRenderer.invoke("show-rules"),
  startTest: () => ipcRenderer.invoke("start-test"),
  getRemainingTime: () => ipcRenderer.invoke("get-time"),
  savePhoto: (data) => ipcRenderer.invoke("save-photo", data),
});
