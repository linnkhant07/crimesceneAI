"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { LiveApiClient } from "@/lib/liveApiClient";
import { buildInterrogationSystemPrompt } from "@/lib/prompts";

const SETTING_LABELS: Record<string, string> = {
  "noir-city": "a 1940s noir city",
  "medieval-castle": "a medieval castle",
  "space-station": "a deep-space station",
  "small-town": "a quiet small town",
};

/** Never update Zustand (or other trees) inside a React setState updater — defer to next task */
function runAfterPaint(fn: () => void) {
  queueMicrotask(() => {
    setTimeout(fn, 0);
  });
}

export default function InterrogationScreen({
  topOffset = false,
  isActive = true,
}: {
  topOffset?: boolean;
  /** When false, voice session is torn down (e.g. user on another investigation tab) */
  isActive?: boolean;
}) {
  const {
    crimeCase,
    quizAnswers,
    interrogation,
    switchSuspect,
    addMessage,
    updateNotes,
    incrementQuestions,
    setScreen,
  } = useGameStore();

  const [showNotes, setShowNotes] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveConnecting, setLiveConnecting] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [suspectSpeaking, setSuspectSpeaking] = useState(false);
  // Accumulates the streaming response; null when no active turn
  const [streamingText, setStreamingText] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const liveClientRef = useRef<LiveApiClient | null>(null);
  const apiKeyRef = useRef<string | null>(null);
  const setupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSuspect = crimeCase?.suspects[interrogation.currentSuspectIndex];
  // Only show suspect messages — user voice is felt, not shown
  const currentChat = (
    interrogation.chatHistories[interrogation.currentSuspectIndex] || []
  ).filter((m) => m.role === "suspect");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat, streamingText]);

  const resetConnection = useCallback((errorMsg?: string) => {
    setLiveConnected(false);
    setLiveConnecting(false);
    setIsRecording(false);
    setStreamingText(null);
    if (errorMsg) setLiveError(errorMsg);
    if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);
  }, []);

  const connectLiveApi = useCallback(
    async (suspectIdx: number) => {
      if (!crimeCase || !quizAnswers) return;
      const suspect = crimeCase.suspects[suspectIdx];
      if (!suspect) return;

      setLiveConnecting(true);
      setLiveConnected(false);
      setLiveError(null);
      setStreamingText(null);
      if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);

      try {
        if (!apiKeyRef.current) {
          const res = await fetch("/api/live-token");
          const data = await res.json();
          apiKeyRef.current = data.apiKey;
        }

        if (!apiKeyRef.current) {
          resetConnection("API key unavailable.");
          return;
        }

        if (liveClientRef.current) {
          liveClientRef.current.disconnect(true);
        }

        const client = new LiveApiClient({
          onTranscriptUpdate: (role, text) => {
            if (role === "suspect") {
              setStreamingText(text);
            } else {
              runAfterPaint(() => incrementQuestions());
            }
          },
          onConnectionChange: (connected) => {
            if (connected) {
              setLiveConnected(true);
              setLiveConnecting(false);
              setLiveError(null);
              if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);
            } else {
              setLiveConnected(false);
              setLiveConnecting(false);
              setIsRecording(false);
            }
          },
          onError: (error) => {
            console.error("Live API error:", error);
            runAfterPaint(() => resetConnection(error));
          },
          onAudioStart: () => setSuspectSpeaking(true),
          onAudioEnd: () => {
            setSuspectSpeaking(false);
            // Capture text, clear bubble, then commit to Zustand after React finishes this update
            setStreamingText((current) => {
              const saved = current?.trim() ?? "";
              if (saved) {
                runAfterPaint(() => {
                  addMessage(suspectIdx, {
                    role: "suspect",
                    content: saved,
                    timestamp: Date.now(),
                  });
                });
              }
              return null;
            });
          },
        });

        const systemPrompt = buildInterrogationSystemPrompt(
          suspect.name,
          suspect,
          SETTING_LABELS[quizAnswers.setting] || quizAnswers.setting,
          `${crimeCase.victim.name} was found dead at ${crimeCase.location}. Cause of death: ${crimeCase.causeOfDeath}. Time: ${crimeCase.timeOfDeath}.`,
          {
            name: quizAnswers.detectiveName,
            personalDetail: quizAnswers.personalDetail,
            casePersonalization: crimeCase.personalizedDetail ?? "",
          }
        );

        await client.connect(apiKeyRef.current, systemPrompt, suspectIdx, suspect.gender ?? "male");
        liveClientRef.current = client;

        setupTimeoutRef.current = setTimeout(() => {
          if (!liveClientRef.current?.connected) {
            resetConnection("Connection timed out. Tap reconnect to try again.");
          }
        }, 10000);
      } catch (error) {
        console.error("Failed to connect Live API:", error);
        resetConnection("Failed to connect. Tap reconnect to try again.");
      }
    },
    [crimeCase, quizAnswers, addMessage, incrementQuestions, resetConnection]
  );

  // Connect while interrogation tab is active; disconnect when hidden or unmounting
  useEffect(() => {
    if (!crimeCase || !quizAnswers) return;

    if (!isActive) {
      if (liveClientRef.current) liveClientRef.current.disconnect(true);
      setLiveConnected(false);
      setLiveConnecting(false);
      setIsRecording(false);
      setSuspectSpeaking(false);
      setStreamingText(null);
      if (setupTimeoutRef.current) {
        clearTimeout(setupTimeoutRef.current);
        setupTimeoutRef.current = null;
      }
      return;
    }

    connectLiveApi(interrogation.currentSuspectIndex);

    return () => {
      if (liveClientRef.current) liveClientRef.current.disconnect(true);
      if (setupTimeoutRef.current) {
        clearTimeout(setupTimeoutRef.current);
        setupTimeoutRef.current = null;
      }
    };
  }, [
    isActive,
    crimeCase,
    quizAnswers,
    interrogation.currentSuspectIndex,
    connectLiveApi,
  ]);

  const handleSwitchSuspect = useCallback(
    (index: number) => {
      switchSuspect(index);
      setStreamingText(null);
    },
    [switchSuspect]
  );

  const handleMicDown = useCallback(() => {
    console.log("[MIC] handleMicDown — connected:", liveClientRef.current?.connected);
    if (liveClientRef.current?.connected) {
      liveClientRef.current.startRecording();
      setIsRecording(true);
    }
  }, []);

  const handleMicUp = useCallback(() => {
    if (liveClientRef.current) {
      liveClientRef.current.stopRecording();
    }
    setIsRecording(false);
  }, []);

  // ⌘ (Mac) hold-to-speak shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" && !e.repeat) handleMicDown();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") handleMicUp();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleMicDown, handleMicUp]);

  if (!crimeCase || !currentSuspect) return null;

  return (
    <div className={`fixed inset-0 bg-[#060608] flex ${topOffset ? "top-10" : ""}`}>
      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <div className="w-72 border-r border-amber-950/40 flex flex-col bg-black/20">

        {/* Portrait */}
        <div className="p-5 border-b border-amber-950/30 flex-shrink-0">
          <div className="w-full aspect-square bg-gray-900 mb-4 flex items-center justify-center rounded-sm overflow-hidden relative">
            {currentSuspect.portraitUrl ? (
              <img
                src={currentSuspect.portraitUrl}
                alt={currentSuspect.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-6xl opacity-60">
                {["👤", "🧑", "👩"][interrogation.currentSuspectIndex % 3]}
              </span>
            )}
            {suspectSpeaking && (
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 bg-black/80 px-2 py-1 rounded">
                <div className="flex gap-0.5 items-end">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-red-500 rounded-full animate-pulse"
                      style={{ height: `${8 + (i % 3) * 6}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
                <span className="text-red-400 font-mono text-[10px] ml-1 tracking-widest">SPEAKING</span>
              </div>
            )}
          </div>
          <h3 className="text-gray-200 font-mono text-base mb-0.5">{currentSuspect.name}</h3>
          <p className="text-gray-600 text-xs font-mono mb-3">{currentSuspect.occupation}</p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-600 animate-pulse" />
            <span className="text-yellow-700 text-xs font-mono leading-tight">
              {currentSuspect.personality.split(".")[0]}
            </span>
          </div>
        </div>

        {/* Suspect switcher */}
        <div className="p-4 border-b border-amber-950/30 flex-shrink-0">
          <p className="text-gray-600 font-mono text-[10px] tracking-widest mb-2">SWITCH SUSPECT</p>
          <div className="flex gap-2">
            {crimeCase.suspects.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSwitchSuspect(i)}
                className={`flex-1 py-2 px-2 font-mono text-xs border transition-all cursor-pointer ${
                  i === interrogation.currentSuspectIndex
                    ? "border-red-800 text-red-500 bg-red-500/10"
                    : "border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400"
                }`}
              >
                {s.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Connection status */}
        <div className="p-4 border-b border-amber-950/30 flex-shrink-0">
          {liveError ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-red-600 font-mono text-[10px] leading-tight">{liveError}</span>
              </div>
              <button
                onClick={() => connectLiveApi(interrogation.currentSuspectIndex)}
                className="w-full py-1.5 border border-red-800/60 text-red-500 font-mono text-xs
                           hover:bg-red-500/10 transition-all cursor-pointer"
              >
                ↺ RECONNECT
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                liveConnected ? "bg-green-500" : "bg-yellow-600 animate-pulse"
              }`} />
              <span className="text-gray-600 font-mono text-[10px] tracking-wider">
                {liveConnected ? "LIVE — HOLD MIC TO SPEAK" : "CONNECTING..."}
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-600 font-mono text-[10px] tracking-widest">MY CLUE NOTES</p>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="text-gray-700 text-xs hover:text-gray-400 cursor-pointer"
            >
              {showNotes ? "hide" : "show"}
            </button>
          </div>
          {showNotes && (
            <textarea
              value={interrogation.notes}
              onChange={(e) => updateNotes(e.target.value)}
              placeholder="Jot down your thoughts..."
              className="w-full h-32 bg-gray-900/50 border border-gray-800 text-gray-400 text-xs p-2
                         focus:outline-none focus:border-gray-700 resize-none font-mono"
            />
          )}
        </div>
      </div>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-amber-950/30 flex items-center justify-between flex-shrink-0 bg-black/15">
          <div>
            <p className="text-amber-900/70 font-mono text-[9px] tracking-[0.35em] mb-1 uppercase">
              Sherlock AI · interview room
            </p>
            <span className="text-amber-700/90 font-mono text-xs tracking-[0.2em]">SUBJECT:</span>
            <span className="text-amber-100/90 font-display text-base ml-2">{currentSuspect.name}</span>
          </div>
          <span className="text-gray-700 font-mono text-xs">
            {interrogation.questionsAsked} turns
          </span>
        </div>

        {/* Transcript — suspect only */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentChat.length === 0 && !streamingText && (
            <div className="text-center text-gray-700 font-mono text-sm py-16 max-w-md mx-auto">
              <p className="mb-2 text-gray-500">Oil lamp flicker. A chair creaks.</p>
              <p className="mb-3 text-gray-400">They wait for your first move.</p>
              <p className="text-xs text-gray-600">Hold the mic or ⌘ to speak.</p>
            </div>
          )}

          {currentChat.map((msg, i) => (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] bg-gray-900/50 border border-gray-800 px-4 py-3 text-sm">
                <p className="text-red-900 font-mono text-[10px] mb-1 tracking-wider">
                  ▸ {currentSuspect.name}
                </p>
                <p className="text-gray-300 leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Live streaming bubble */}
          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-gray-900/60 border border-red-900/30 px-4 py-3 text-sm">
                <p className="text-red-700 font-mono text-[10px] mb-1 tracking-wider">
                  ▸ {currentSuspect.name}
                </p>
                <p className="text-gray-300 leading-relaxed">
                  {streamingText}
                  <span className="inline-block w-1.5 h-4 bg-red-500/60 ml-0.5 animate-pulse align-middle" />
                </p>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* ── Bottom controls ───────────────────────────────────── */}
        <div className="p-6 border-t border-amber-950/30 flex-shrink-0">
          <div className="flex items-center justify-between gap-6">

            {/* Mic button — the primary control */}
            <button
              onMouseDown={handleMicDown}
              onMouseUp={handleMicUp}
              onMouseLeave={handleMicUp}
              onTouchStart={(e) => { e.preventDefault(); handleMicDown(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleMicUp(); }}
              disabled={!liveConnected}
              className={`flex-1 py-5 border-2 font-mono text-sm tracking-widest transition-all select-none
                ${isRecording
                  ? "border-red-500 text-red-400 bg-red-500/10 scale-[0.98] shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                  : liveConnected
                    ? "border-gray-700 text-gray-400 hover:border-red-800/60 hover:text-red-400 active:scale-[0.98] cursor-pointer"
                    : "border-gray-800 text-gray-700 cursor-not-allowed opacity-40"
                }`}
            >
              {isRecording
                ? "🎤  RECORDING — RELEASE TO SEND"
                : liveConnected
                  ? "HOLD TO SPEAK  ·  ⌘"
                  : liveConnecting ? "CONNECTING..." : "DISCONNECTED"
              }
            </button>

            {/* Accusation */}
            <button
              onClick={() => setScreen("accusation")}
              className="px-6 py-5 border border-red-900/40 text-red-600 font-mono text-xs tracking-widest
                         hover:bg-red-500/10 hover:border-red-700/60 transition-all cursor-pointer whitespace-nowrap"
            >
              VERDICT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
