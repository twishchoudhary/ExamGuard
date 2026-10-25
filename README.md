# ExamGuard - Secure Examination Desktop Application

A modern desktop assessment and proctoring application built with **Electron** and **React**, focusing on desktop APIs, window management, IPC messaging, and system-level security interactions.

---

## 9 Confirmed Implementation Features

### 1. Camera Access
- Requests and grants camera permissions seamlessly via Electron session handlers.
- Streams live webcam video feed with device selection support.
- Displays live preview in setup and a persistent floating picture-in-picture (PIP) proctor widget during active exams.

### 2. Microphone Access
- Requests microphone permission and acquires live audio stream.
- Seamlessly integrates system audio capture through modern media APIs.

### 3. Camera and Microphone Check
- Pre-flight diagnostic verification before entering the assessment:
  - **Camera Check:** Confirms webcam stream readiness and video frame delivery.
  - **Microphone Check:** Confirms audio hardware input stream acquisition and permissions.
- Gatekeeper lock: The "Go To Test" button remains locked until both devices are verified.

### 4. Fullscreen Mode
- Automatically engages Electron fullscreen mode upon exam entry.
- Real-time detection of fullscreen exits via Electron `leave-full-screen` window events and DOM fallback.
- On fullscreen exit, displays an interactive security modal blocking assessment access until the candidate returns to fullscreen, logging a violation strike and capturing an evidentiary screenshot.

### 5. Quit Warning
- Native protection against accidental or intentional window closure during active exams.
- The Main process intercepts `BrowserWindow.on('close')` and `app.on('before-quit')`.
- Displays a native Electron confirmation warning dialog alerting the candidate that quitting forfeits submission.
- Renderer displays an on-screen security notification and logs the attempt.

### 6. Tab Switching & Focus Loss Detection
- Monitors system-level window focus changes via Electron `win.on('blur')` and `win.on('focus')` IPC events.
- Secondary DOM safeguards monitor `window.onblur` and `document.visibilitychange`.
- Navigating away from the exam window or switching applications logs a security strike, captures a screenshot, and displays an acknowledgement warning on focus return.

### 7. Safe Session Recovery
- Persistent session storage written atomically to disk in Electron `userData/athena_exam_session.json`.
- Automatically persists current question index, selected answers, flagged questions, timer countdown, and violation history.
- Autosaves on every answer selection, navigation step, violation, and every 4 seconds in the background.
- Upon application restart after an interruption (crash, reboot, close), detects the uncompleted session and offers seamless state recovery.

### 8. Periodic Screenshot Capturing
- Electron Main process captures full-resolution window screenshots via `BrowserWindow.webContents.capturePage()`.
- Captures automatically every 15 seconds during an active exam.
- Also captures screenshots upon security triggers (tab switch, fullscreen exit, quit attempt).
- Stores PNG images on disk and indexes metadata (timestamp, reason, question ID, thumbnail).
- Saves synchronized webcam snapshots to the camera feed folder.

### 9. Manual Screenshot Review
- Dedicated Invigilator Review Console to audit all captured screenshots.
- Statistics summary: Total Captures, Security Violations, Periodic Snapshots, Flagged Suspicious.
- Filter tabs: All, Security Violations, Periodic, Flagged.
- Full-screen Lightbox inspector with high-resolution image zoom.
- Interactive actions: Toggle "Flag as Suspicious", "Mark as Reviewed", add and save custom invigilator audit notes.
- "Open Local Folder" button to inspect raw captures directly in macOS Finder / OS Explorer.

---

## Architecture & IPC Channels

| IPC Channel | Type | Purpose |
|---|---|---|
| `set-fullscreen` | `handle` | Toggles Electron window fullscreen mode |
| `is-fullscreen` | `handle` | Queries current window fullscreen status |
| `fullscreen-state-change` | `send` (Event) | Notifies renderer when fullscreen is entered/exited |
| `set-exam-active` | `handle` | Sets active exam flag in main process for close protection |
| `quit-attempt-blocked` | `send` (Event) | Alerts renderer when window close was intercepted |
| `window-focus-changed` | `send` (Event) | Emits `{ focused, timestamp }` on window blur/focus |
| `save-session` | `handle` | Persists exam session data atomically to disk |
| `get-saved-session` | `handle` | Reads saved session data from disk |
| `clear-session` | `handle` | Deletes or resets saved exam session |
| `capture-screenshot` | `handle` | Captures screen via `webContents.capturePage()` and indexes it |
| `get-screenshots` | `handle` | Returns array of all indexed screenshots with metadata |
| `get-screenshot-full` | `handle` | Reads full-resolution screenshot buffer as base64 |
| `update-screenshot` | `handle` | Updates screenshot flags, reviewed status, and notes |
| `open-screenshots-folder` | `handle` | Opens local screenshots directory in OS file manager |
| `save-camera-snapshot` | `handle` | Saves webcam proctor photo to disk |
| `show-rules` | `handle` | Displays native dialog with exam rules |
| `window-minimize`, `window-maximize`, `window-close` | `handle` | Window controls for custom frameless titlebar |

---

## Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
Start the Vite development server:
```bash
npm run dev
```

In a separate terminal, launch Electron:
```bash
npm start
```

### 3. Build Production Bundle
```bash
npm run build
```
When built, Electron can also run directly from the production bundle:
```bash
npm start
```
