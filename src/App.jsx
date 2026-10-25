import { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";
import { mockQuestions } from "./data/mockQuestions";

export default function App() {
  const videoRef = useRef(null);
  const examVideoRef = useRef(null);
  const micStreamRef = useRef(null);

  // Exam state
  const questions = mockQuestions;
  const totalQuestions = questions.length;
  const [questionId, setQuestionId] = useState(1);
  const [answers, setAnswers] = useState({});
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(3600); // 60 mins

  // Device & Proctoring states (Features 1, 2, 3)
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  // Security & Violations (Features 4, 5, 6)
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [blurWarning, setBlurWarning] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);

  // Safe Session Recovery (Feature 7)
  const [recoveredSession, setRecoveredSession] = useState(null);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);

  // Modals & Review (Features 8, 9)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [screenshots, setScreenshots] = useState([]);
  const [selectedFullShot, setSelectedFullShot] = useState(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // -------------------------------------------------------------
  // Feature 8: Screenshot Capturing Trigger
  // -------------------------------------------------------------
  const triggerScreenshot = useCallback(
    async (reason = "periodic") => {
      try {
        if (window.electronAPI?.captureScreenshot) {
          await window.electronAPI.captureScreenshot({
            reason,
            questionNumber: questionId,
            studentName: "User",
          });
        }
      } catch (e) {
        console.error("Screenshot capture error:", e);
      }
    },
    [questionId]
  );

  // -------------------------------------------------------------
  // Feature 1: Camera Access
  // -------------------------------------------------------------
  async function getCamera() {
    try {
      if (window.electronAPI?.requestCameraPermission) {
        await window.electronAPI.requestCameraPermission();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      alert(err.name === "NotAllowedError" ? "Camera permission denied in system settings." : `Camera error: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // Feature 2: Microphone Access
  // -------------------------------------------------------------
  async function getMicrophone() {
    try {
      if (window.electronAPI?.requestMicPermission) {
        await window.electronAPI.requestMicPermission();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicReady(true);
    } catch (err) {
      console.error("Microphone access failed:", err);
      alert(err.name === "NotAllowedError" ? "Microphone permission denied. Please allow microphone access in system settings." : `Microphone error: ${err.message}`);
    }
  }

  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // -------------------------------------------------------------
  // Feature 4: Fullscreen Mode & Exam Lifecycle
  // -------------------------------------------------------------
  const toggleFullscreen = useCallback(async (enable = true) => {
    if (window.electronAPI?.setFullScreen) {
      const fs = await window.electronAPI.setFullScreen(enable);
      setIsFullScreen(fs);
      if (fs) setFullscreenWarning(false);
    }
  }, []);

  const endTest = useCallback(async () => {
    setStarted(false);
    if (window.electronAPI?.setExamActive) await window.electronAPI.setExamActive(false);
    if (window.electronAPI?.clearSession) await window.electronAPI.clearSession();
    await toggleFullscreen(false);
    alert("Test ended successfully. Your responses and screenshots have been recorded.");
  }, [toggleFullscreen]);

  // -------------------------------------------------------------
  // Feature 7: Safe Session Recovery Persistence
  // -------------------------------------------------------------
  const saveCurrentSession = useCallback(
    async (extra = {}) => {
      if (!started || !window.electronAPI?.saveSession) return;
      await window.electronAPI.saveSession({
        questionId,
        answers,
        time,
        strikeCount,
        ...extra,
      });
    },
    [started, questionId, answers, time, strikeCount]
  );

  useEffect(() => {
    (async () => {
      if (window.electronAPI?.getSavedSession) {
        const res = await window.electronAPI.getSavedSession();
        if (res?.success && res.session?.answers) {
          setRecoveredSession(res.session);
          setShowRecoveryBanner(true);
        }
      }
    })();
  }, []);

  function resumeSavedSession() {
    if (!recoveredSession) return;
    setAnswers(recoveredSession.answers || {});
    setQuestionId(recoveredSession.questionId || 1);
    setTime(recoveredSession.time || 3600);
    setStrikeCount(recoveredSession.strikeCount || 0);
    setShowRecoveryBanner(false);
    setStarted(true);
    toggleFullscreen(true);
  }

  function discardSavedSession() {
    if (window.electronAPI?.clearSession) window.electronAPI.clearSession();
    setShowRecoveryBanner(false);
    setRecoveredSession(null);
  }

  // -------------------------------------------------------------
  // Proctored Exam Listeners (Features 4, 5, 6, 8)
  // -------------------------------------------------------------
  useEffect(() => {
    if (window.electronAPI?.setExamActive) {
      window.electronAPI.setExamActive(started);
    }
    const unsubQuit = window.electronAPI?.onQuitAttemptBlocked?.(() => {
      alert("Warning: Attempting to close the application during an exam is not allowed.");
    });
    return () => unsubQuit && unsubQuit();
  }, [started]);

  // Fullscreen exit detection
  useEffect(() => {
    const onFs = ({ isFullScreen: fs }) => {
      setIsFullScreen(fs);
      if (!fs && started) {
        setFullscreenWarning(true);
        setStrikeCount((s) => s + 1);
        triggerScreenshot("fullscreen-exit");
      } else if (fs) {
        setFullscreenWarning(false);
      }
    };
    const unsubFs = window.electronAPI?.onFullScreenChange?.(onFs);
    const handleDomFs = () => {
      if (!document.fullscreenElement && started) {
        setFullscreenWarning(true);
        setStrikeCount((s) => s + 1);
        triggerScreenshot("fullscreen-exit");
      }
    };
    document.addEventListener("fullscreenchange", handleDomFs);
    return () => {
      if (unsubFs) unsubFs();
      document.removeEventListener("fullscreenchange", handleDomFs);
    };
  }, [started, triggerScreenshot]);

  // Focus & Tab Switch Detection
  useEffect(() => {
    if (!started) return;
    const onFocusChange = ({ focused }) => {
      if (!focused) {
        setBlurWarning(true);
        setStrikeCount((s) => s + 1);
        triggerScreenshot("tab-switch");
      }
    };
    const unsubFocus = window.electronAPI?.onWindowFocusChange?.(onFocusChange);
    const handleBlur = () => {
      setBlurWarning(true);
      setStrikeCount((s) => s + 1);
      triggerScreenshot("tab-switch");
    };
    const handleVis = () => {
      if (document.hidden) handleBlur();
    };
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVis);
    return () => {
      if (unsubFocus) unsubFocus();
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, [started, triggerScreenshot]);

  // Exam periodic captures (every 15s) and timer/autosave
  useEffect(() => {
    if (!started) return;
    triggerScreenshot("start");
    const shotInterval = setInterval(() => triggerScreenshot("periodic"), 15000);
    const timer = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          endTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    const autoSave = setInterval(() => saveCurrentSession(), 4000);

    return () => {
      clearInterval(shotInterval);
      clearInterval(timer);
      clearInterval(autoSave);
    };
  }, [started, triggerScreenshot, saveCurrentSession, endTest]);

  // PIP Camera connection
  useEffect(() => {
    if (examVideoRef.current && cameraStream) {
      examVideoRef.current.srcObject = cameraStream;
      examVideoRef.current.play().catch(() => {});
    }
  }, [started, cameraStream]);

  // -------------------------------------------------------------
  // Feature 9: Screenshot Review Actions
  // -------------------------------------------------------------
  async function openReviewModal() {
    if (window.electronAPI?.getScreenshots) {
      const res = await window.electronAPI.getScreenshots();
      if (res?.success) setScreenshots(res.screenshots || []);
    }
    setShowReviewModal(true);
  }

  // -------------------------------------------------------------
  // Test Navigation & Flow
  // -------------------------------------------------------------
  function handleSelectOption(index) {
    const next = { ...answers, [questionId]: index };
    setAnswers(next);
    saveCurrentSession({ answers: next });
  }

  async function handleGoToTest() {
    if (!cameraReady || !micReady) {
      alert("Please configure and verify both Camera and Microphone before starting the test.");
      return;
    }
    await toggleFullscreen(true);
    setShowRulesModal(true);
  }

  function handleAcceptRules() {
    setShowRulesModal(false);
    setStarted(true);
  }

  async function handleCancelRules() {
    setShowRulesModal(false);
    await toggleFullscreen(false);
  }


  const formatTime = (sec) => {
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    const m = Math.floor((sec / 60) % 60).toString().padStart(2, "0");
    const h = Math.floor(sec / 3600).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const currentQuestion = questions[questionId - 1] || questions[0];

  return (
    <>
      {started ? (
        /* ==================== EXAM VIEW ==================== */
        <div className="exam-page">
          <video ref={examVideoRef} autoPlay muted playsInline className="video-preview" />
          <div className="exam-container">
            {fullscreenWarning && (
              <div className="alert-banner danger">
                <span>⚠️ Fullscreen exited! Please return to fullscreen mode immediately.</span>
                <button className="btn btn-dark" onClick={() => toggleFullscreen(true)}>
                  Return to Fullscreen
                </button>
              </div>
            )}
          
            {blurWarning && (
              <div className="alert-banner warning">
                <span>⚠️ Tab switch / Window focus loss detected! (Strikes: {strikeCount})</span>
                <button className="btn btn-outline" onClick={() => setBlurWarning(false)}>
                  Acknowledge
                </button>
              </div>
            )}

            <div className="exam-header">
              <h3>Time Left : {formatTime(time)}</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-outline" onClick={openReviewModal}>
                  Review Screenshots
                </button>
                <button className="end-test-btn" onClick={endTest}>
                  End Test
                </button>
              </div>
            </div>
          
            {currentQuestion && (
              <div className="question-card">
                <h2>Question {questionId} of {totalQuestions}</h2>
                <p>{currentQuestion.question}</p>
                {currentQuestion.options.map((option, index) => (
                  <label key={index} className="option-row">
                    <input
                      type="radio"
                      name={`q-${questionId}`}
                      checked={answers[questionId] === index}
                      onChange={() => handleSelectOption(index)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
                <div className="navigation-buttons">
                  <button onClick={() => setQuestionId((q) => Math.max(1, q - 1))} disabled={questionId === 1}>
                    Previous
                  </button>
                  <button onClick={() => setQuestionId((q) => Math.min(totalQuestions, q + 1))} disabled={questionId === totalQuestions}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== SETUP VIEW ==================== */
        <>
          <div className="top-nav">
            <span className="brand-logo">ExamGuard</span>
            <div className="nav-actions">
              <button className="btn btn-outline" onClick={openReviewModal}>
                Review Screenshots
              </button>
            </div>
          </div>

          <div className="page-container">
            {showRecoveryBanner && recoveredSession && (
              <div className="alert-banner info">
                <span>
                  <strong>Safe Session Recovery:</strong> An interrupted session was found from{" "}
                  {new Date(recoveredSession.lastSavedAt || 0).toLocaleTimeString()}.
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-dark" onClick={resumeSavedSession}>
                    Resume Saved Test
                  </button>
                  <button className="btn btn-outline" onClick={discardSavedSession}>
                    Discard
                  </button>
                </div>
              </div>
            )}

            <div className="header-section">
              <h1>Complete Your Setup</h1>
              <p>Kindly allow the following permissions to start the test:</p>
            </div>

            <div className="card-container">
              {/* Camera Access */}
              <div className="permission-item">
                <div className="permission-icon">↗</div>
                <div className="permission-content">
                  <h3>Configure Camera</h3>
                  <p>Kindly configure Camera to attempt quiz/contests.</p>
                  <div className="action-row">
                    <button onClick={getCamera} className={`btn ${cameraReady ? "btn-success" : "btn-dark"}`}>
                      {cameraReady ? "✓ Camera Connected" : "Get Camera Access"}
                    </button>
                  </div>
                </div>
                <div className="permission-media-box">
                  <video ref={videoRef} autoPlay muted playsInline style={{ display: cameraReady ? "block" : "none" }} />
                  {!cameraReady && <span>Camera Preview</span>}
                </div>
              </div>

              <div className="divider" />

              {/* Microphone Access */}
              <div className="permission-item">
                <div className="permission-icon">🎙️</div>
                <div className="permission-content">
                  <h3>Configure Microphone</h3>
                  <p>Kindly configure Microphone to attempt quiz/contests.</p>
                  <div className="action-row">
                    <button onClick={getMicrophone} className={`btn ${micReady ? "btn-success" : "btn-dark"}`}>
                      {micReady ? "✓ Microphone Verified" : "Get Microphone Access"}
                    </button>
                  </div>
                </div>
                <div />
              </div>

              <div className="divider" />

              {/* Fullscreen Mode */}
              <div className="permission-item">
                <div className="permission-icon">⛶</div>
                <div className="permission-content">
                  <h3>Switch to full screen</h3>
                  <p>Kindly close all tabs and switch to full screen.</p>
                  <div className="action-row">
                    <button onClick={() => toggleFullscreen(!isFullScreen)} className={`btn ${isFullScreen ? "btn-success" : "btn-light-blue"}`}>
                      {isFullScreen ? "✓ Fullscreen Enabled" : "Give Full Screen Permissions"}
                    </button>
                  </div>
                </div>
                <div style={{ width: "220px", display: "flex", justifyContent: "center" }}>
                  <span style={{ fontSize: "13px", color: isFullScreen ? "#2e7d32" : "#888", fontWeight: 500 }}>
                    {isFullScreen ? "Ready in Fullscreen" : "Normal Window"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bottom-actions">
              <button
                onClick={handleGoToTest}
                disabled={!cameraReady || !micReady}
                className="btn btn-light-blue"
                title={!cameraReady || !micReady ? "Please configure Camera and Microphone first" : "Go To Test"}
              >
                Go To Test
              </button>
              <button className="btn btn-outline" onClick={openReviewModal}>
                Review Screenshots
              </button>
            </div>
          </div>
        </>
      )}

      {/* ==================== GLOBAL MODALS (RENDERED ONCE) ==================== */}

      {/* Feature 9: Invigilator Screenshot Review Modal */}
      {showReviewModal && (
        <div className="modal-backdrop" onClick={() => setShowReviewModal(false)}>
          <div className="review-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="review-modal-header">
              <h3>Invigilator Screenshot Review ({screenshots.length} Captures)</h3>
              <button className="btn btn-outline" onClick={() => setShowReviewModal(false)}>✕</button>
            </div>
            <div className="review-grid-container">
              {screenshots.length === 0 ? (
                <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>No screenshots captured yet.</p>
              ) : (
                <div className="review-thumbnails-grid">
                  {screenshots.map((shot) => (
                    <div key={shot.id} className="review-shot-card" onClick={() => setSelectedFullShot(shot)}>
                      <img src={shot.thumbnail} alt={shot.reason} />
                      <div className="review-shot-meta">
                        <strong>{shot.reason.toUpperCase()}</strong>
                        <span>{new Date(shot.timestamp).toLocaleTimeString()}</span>
                        {shot.questionNumber && <span>Q#{shot.questionNumber}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="review-modal-footer">
              <button className="btn btn-outline" onClick={() => window.electronAPI?.openScreenshotsFolder?.()}>
                Open Folder in Finder
              </button>
              <button className="btn btn-dark" onClick={() => setShowReviewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedFullShot && (
        <div className="modal-backdrop" onClick={() => setSelectedFullShot(null)}>
          <div className="modal-card" style={{ maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <h3>Screenshot Audit ({selectedFullShot.reason})</h3>
            <p>{new Date(selectedFullShot.timestamp).toLocaleString()}</p>
            <img
              src={selectedFullShot.thumbnail}
              alt="Capture preview"
              style={{ width: "100%", maxHeight: "500px", objectFit: "contain", borderRadius: "8px" }}
            />
            <div className="modal-actions">
              <button className="btn btn-dark" onClick={() => setSelectedFullShot(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Rules & Proctoring Compliance Modal */}
      {showRulesModal && (
        <div className="modal-backdrop">
          <div className="rules-modal-card">
            <div className="rules-modal-header">
              <h3>Candidate Rules &amp; Proctoring Compliance</h3>
              <p className="rules-modal-sub">Please review and acknowledge the proctoring rules before starting the exam.</p>
            </div>
            <div className="rules-list-box">
              <div className="rules-list-item">
                <span className="rule-num">1.</span>
                <span>Camera and microphone monitoring must remain enabled at all times.</span>
              </div>
              <div className="rules-list-item">
                <span className="rule-num">2.</span>
                <span>Fullscreen mode is mandatory. Exiting fullscreen will be logged as a violation.</span>
              </div>
              <div className="rules-list-item">
                <span className="rule-num">3.</span>
                <span>Tab switching or switching to other desktop applications is strictly prohibited.</span>
              </div>
              <div className="rules-list-item">
                <span className="rule-num">4.</span>
                <span>Periodic screenshots of your exam screen are automatically captured and reviewed.</span>
              </div>
              <div className="rules-list-item">
                <span className="rule-num">5.</span>
                <span>Session progress is continuously saved and recoverable in case of system interruption.</span>
              </div>
            </div>
            <div className="rules-modal-actions">
              <button onClick={handleAcceptRules} className="btn btn-light-blue btn-large">
                I Understand &amp; Accept
              </button>
              <button onClick={handleCancelRules} className="btn btn-outline btn-large">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
