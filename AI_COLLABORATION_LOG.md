# ExamGuard - AI Pair Programming & Collaboration History

**Project:** ExamGuard (Secure Examination Desktop Application)  
**Developer:** Twish Choudhary  
**Assistant:** Antigravity AI Pair Programmer  
**Platform:** macOS / Electron + React (Vite)  
**Date:** October 25, 2026  

---

### Session 1: Project Architecture & 9 Core Requirements Setup
**Time:** 09:35 AM

**Twish:**  
Hey! I need to build a proctoring and assessment desktop application called **ExamGuard** using Electron and React. I have a starter boilerplate, but I need to implement 9 specific desktop and system-level proctoring features:
1. Camera access & live preview
2. Microphone access
3. Device pre-flight verification gatekeeper
4. Fullscreen enforcement and exit detection
5. Quit attempt prevention with confirmation warnings
6. Tab switching / window blur detection with strikes
7. Safe session recovery (interrupted session persistence)
8. Periodic and violation screenshot capturing (every 15s)
9. Invigilator manual screenshot review console

I want to use a clean, secure Electron architecture with `contextBridge` and IPC rather than exposing Node directly to the frontend. How should we structure the project and IPC bridge?

**AI Assistant:**  
Great choice of architecture! To keep the application secure and compliant with modern Electron best practices, we should ensure:
- `nodeIntegration: false` and `contextIsolation: true` in `BrowserWindow` webPreferences.
- A dedicated `electron/preload.cjs` using `contextBridge.exposeInMainWorld("electronAPI", {...})` to expose strictly typed, safe IPC channels.
- An IPC communication layer in `electron/main.cjs` handling OS permissions (`systemPreferences.askForMediaAccess`), window management (`win.setFullScreen`), file persistence (`fs.writeFileSync`), and `webContents.capturePage()` for screen auditing.

Let's start by configuring the build tooling, `.gitignore`, and setting up `electron/preload.cjs` with all the IPC method definitions we'll need for these 9 features.

---

### Session 2: macOS Permissions & Hardware Access (Camera & Mic)
**Time:** 11:15 AM

**Twish:**  
I'm working on macOS and when I try to request camera and microphone permissions through `navigator.mediaDevices.getUserMedia`, macOS doesn't always show the system permission modal or it silently fails. How do we properly wire up macOS hardware permissions in Electron?

**AI Assistant:**  
On macOS (Darwin), Chromium's standard web permission request alone isn't always sufficient if the operating system hasn't granted camera/mic permission to the Electron executable.

Here is the robust solution:
1. In `electron/main.cjs`, use `systemPreferences.getMediaAccessStatus(media)` and `systemPreferences.askForMediaAccess(media)` via IPC (`request-camera-permission`, `request-mic-permission`).
2. Configure `session.defaultSession.setPermissionRequestHandler` to automatically approve media capture once the system grants it.
3. In `src/App.jsx`, first invoke the Electron permission check via `window.electronAPI.requestCameraPermission()`, then call `navigator.mediaDevices.getUserMedia`.
4. Connect the resulting `MediaStream` to a preview `<video>` element on the setup card so the candidate can visually verify their framing before starting.

---

### Session 3: Fullscreen Enforcement & Tab Switching Detection
**Time:** 02:45 PM

**Twish:**  
For features 4, 5, and 6, I need strict proctoring security:
- The exam must run in fullscreen, and if the candidate exits fullscreen, it should flag a violation strike and take a screenshot.
- If they press Cmd+Tab or click outside the window, detect the focus loss immediately.
- If they try to close the window (Cmd+Q or red close button) while an exam is running, intercept it and show a native warning.

How do we implement this reliably between Main and Renderer?

**AI Assistant:**  
We can set up dual-layer listeners across both the OS window level and the DOM level:

1. **Quit Warning (Feature 5)**:
   - In `electron/main.cjs`, track `let isExamActive = false;`.
   - Intercept `win.on('close')` and `app.on('before-quit')`. If `isExamActive`, call `e.preventDefault()`, dispatch `quit-attempt-blocked` to the renderer, and display `dialog.showMessageBoxSync` warning that quitting forfeits the test.

2. **Tab Switching / Blur (Feature 6)**:
   - In `main.cjs`, hook `win.on('blur')` and `win.on('focus')` to emit `window-focus-changed` IPC events.
   - In `App.jsx`, add backup listeners for `window.onblur` and `document.onvisibilitychange`.
   - Increment `strikeCount` and call `triggerScreenshot("tab-switch")`.

3. **Fullscreen (Feature 4)**:
   - Listen to `win.on('leave-full-screen')` and DOM `fullscreenchange`.
   - If fullscreen drops during an active test, display a warning banner requiring them to click "Return to Fullscreen" and log the event.

---

### Session 4: Safe Session Recovery & Screenshot Engine
**Time:** 06:20 PM

**Twish:**  
Let's implement features 7, 8, and 9:
- What's the best way to do Safe Session Recovery so answers aren't lost if power goes out or the app crashes?
- And for periodic screenshots, how do we capture and store them for the invigilator review modal?

**AI Assistant:**  
1. **Safe Session Recovery (Feature 7)**:
   - Store session state in `userData/athena_exam_session.json`.
   - In `App.jsx`, trigger `saveCurrentSession()` whenever a candidate selects an answer, changes questions, and on a 4-second background interval.
   - When the app launches, call `window.electronAPI.getSavedSession()`. If an incomplete session is found, render a "Resume Saved Test" banner restoring the question index, selected radio answers, elapsed timer, and strike count.

2. **Periodic & Evidentiary Screenshots (Feature 8 & 9)**:
   - In `main.cjs`, use `win.webContents.capturePage()` to grab full-resolution snapshots.
   - Save the PNG buffer to `userData/athena_screenshots/shot_<timestamp>_<reason>.png`.
   - Generate a lightweight 340px thumbnail and append a record to `athena_screenshots/index.json`.
   - Build an **Invigilator Review Modal** in React that fetches `getScreenshots()`, displays a thumbnail grid with timestamps and reasons (PERIODIC, TAB-SWITCH, FULLSCREEN-EXIT), and allows opening a full-size lightbox or launching the folder in Finder via `shell.openPath()`.

---

### Session 5: UI Alignment & Theme Customization
**Time:** 08:30 PM

**Twish:**  
I don't want a generic dark cyberpunk UI. I have a reference screenshot of the original setup page:
- Clean minimalist white card (`.card-container`) on an off-white `#f5f4f2` background.
- Clean typography and icons: `↗` for Camera, `🎙️` for Microphone, `⛶` for Fullscreen.
- High-contrast buttons with smooth hover transitions (`.btn-dark`, `.btn-light-blue`).
- Brand logo: "ExamGuard".
- The Candidate Rules & Proctoring Compliance warning should pop up on fullscreen after clicking "Go To Test" in the exact same clean theme.

Let's make sure the styling strictly matches this.

**AI Assistant:**  
Understood! Let's update `src/App.css` and `src/App.jsx`:
- Page background: `#f5f4f2`, card container: `#ffffff` with subtle border `#e7e4df` and border-radius `12px`.
- Button styling:
  - Dark button (`#263c53` -> `#14273b` on hover with elevation).
  - Light blue button (`#7eb5e9` -> `#2575cf` on hover with glow).
  - Radio options with subtle slide animation (`translateX(4px)`) and blue highlight on selection.
- Replace the native OS rules dialog with an in-app React modal (`.rules-modal-card`) matching the white card styling, showing points 1–5 and "I Understand & Accept" on fullscreen.

---

### Session 6: Code Streamlining & Performance Optimization
**Time:** 09:40 PM

**Twish:**  
The features and UI look great, but the codebase has grown to over 2,300 lines with duplicated modal JSX and verbose handlers. Without affecting any feature or UI of the project at all, can we reduce the code?

**AI Assistant:**  
Absolutely! We can perform a major clean-up and reduce the codebase by ~500–600 lines while keeping 100% of the UI and behavior identical:
1. **Eliminate Duplicated Modals**: In `App.jsx`, the Invigilator Review modal and Lightbox modal were declared twice (once inside `started` view and once in setup view). We can render them once at the root level, saving ~130+ lines of duplicate JSX.
2. **Consolidate Event Handlers & Hooks**: Merge redundant window focus and fullscreen listeners, and memoize `toggleFullscreen` and `endTest` using `useCallback`.
3. **Streamline `electron/main.cjs`**: Introduce reusable JSON file helpers (`readJSON`, `writeJSON`) and unified Darwin permission helpers, cutting `main.cjs` from 533 lines down to ~300 lines.
4. Verify with `npm run lint` and `npm run build` to confirm 0 errors and 0 warnings.

---

### Session 7: Audio Verification Simplification & DMG Packaging
**Time:** 10:50 PM

**Twish:**  
1. Let's remove the audio volume level meter box from the setup page and just have the clean microphone permission button like the original reference image.
2. I need to build a native macOS `.dmg` installer for submission, and also get the download build link.

**AI Assistant:**  
Done!
1. Removed the `micLevel` state, `AudioContext`, and `AnalyserNode` frequency loop from `App.jsx` and removed `.mic-check-box` from `App.css`. Microphone access now simply requests the audio stream and marks verified immediately upon grant.
2. Added `electron-builder` configuration in `package.json` with macOS target `dmg` (arm64 Apple Silicon) and necessary `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` entries for macOS security.
3. Compiled production bundle via `npm run build:mac`. Generated native installer:
   `release/ExamGuard-1.0.0-arm64.dmg` (112 MB, verified with CRC32 checksums).
4. Tagged release `v1.0.0` and pushed all changes to GitHub at `https://github.com/twishchoudhary/ExamGuard`.
