export const mockQuestions = [
  {
    id: 1,
    category: "System Architecture",
    question: "In Electron, how does the Renderer process securely communicate with the Main process without exposing Node.js primitives?",
    options: [
      "By setting nodeIntegration: true and directly importing 'fs' in renderer",
      "Using contextBridge.exposeInMainWorld() in a preload script with ipcRenderer",
      "Through direct window.eval() calls dispatched across threads",
      "By opening an unencrypted WebSocket port on localhost:8080"
    ],
    correctAnswer: 1,
    explanation: "contextBridge.exposeInMainWorld() safely exposes a constrained set of IPC APIs from the preload script into the renderer window without giving the web page full Node.js access."
  },
  {
    id: 2,
    category: "Web APIs & Proctoring",
    question: "Which browser API is used to capture live microphone input and analyze real-time audio volume levels in JavaScript?",
    options: [
      "navigator.mediaDevices.getUserMedia() combined with Web Audio API's AudioContext and AnalyserNode",
      "window.speechSynthesis and SpeechRecognition APIs",
      "document.getAudioElement() with HTML5 <audio> volume property",
      "navigator.hardwareAudio.getLevel()"
    ],
    correctAnswer: 0,
    explanation: "getUserMedia({ audio: true }) acquires the MediaStream, which can be connected to an AudioContext and AnalyserNode to inspect frequency data and compute RMS audio volume."
  },
  {
    id: 3,
    category: "Operating System & Window Security",
    question: "When building a secure proctoring exam client, which window event best detects when a candidate switches to another application?",
    options: [
      "The window 'resize' event",
      "The window 'blur' event and document 'visibilitychange' event",
      "The mouse 'mouseout' event on the body tag",
      "The window 'beforeunload' event"
    ],
    correctAnswer: 1,
    explanation: "When a user presses Alt+Tab, Cmd+Tab, or clicks another window, the current BrowserWindow fires 'blur' and document.visibilityState changes to 'hidden'."
  },
  {
    id: 4,
    category: "Fault Tolerance & Persistence",
    question: "Why should safe session recovery write exam state atomically to persistent storage during an online assessment?",
    options: [
      "To prevent exam data loss in case of power failure, app crash, or accidental window closure",
      "To slow down the student's typing speed for fairer grading",
      "To bypass the need for an internet connection entirely",
      "Because RAM memory is cleared whenever a radio button is selected"
    ],
    correctAnswer: 0,
    explanation: "Atomic persistence ensures the candidate can seamlessly resume their exam from the exact question and timer without loss of progress if an unexpected interruption occurs."
  },
  {
    id: 5,
    category: "Desktop Screen Auditing",
    question: "Which Electron API enables taking a snapshot of the current BrowserWindow content for periodic proctoring logs?",
    options: [
      "BrowserWindow.webContents.capturePage()",
      "document.body.toDataURL()",
      "electron.screen.snapshot()",
      "navigator.clipboard.readImage()"
    ],
    correctAnswer: 0,
    explanation: "win.webContents.capturePage() captures a NativeImage of the window rendered contents, which can be converted to PNG/JPEG buffers and stored for invigilator review."
  }
];
