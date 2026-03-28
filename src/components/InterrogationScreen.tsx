"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { LiveApiClient } from "@/lib/liveApiClient";
import { buildInterrogationSystemPrompt } from "@/lib/prompts";

type VoiceMode = "text" | "live";

const SETTING_LABELS: Record<string, string> = {
  "noir-city": "a 1940s noir city",
  "medieval-castle": "a medieval castle",
  "space-station": "a deep-space station",
  "small-town": "a quiet small town",
};

export default function InterrogationScreen() {
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

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("text");
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveConnecting, setLiveConnecting] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [suspectSpeaking, setSuspectSpeaking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const liveClientRef = useRef<LiveApiClient | null>(null);
  const apiKeyRef = useRef<string | null>(null);
  const setupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSuspect =
    crimeCase?.suspects[interrogation.currentSuspectIndex];
  const currentChat =
    interrogation.chatHistories[interrogation.currentSuspectIndex] || [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat]);

  const dropToTextMode = useCallback((reason?: string) => {
    setVoiceMode("text");
    setLiveConnected(false);
    setLiveConnecting(false);
    setIsRecording(false);
    if (reason) setLiveError(reason);
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
      if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);

      try {
        if (!apiKeyRef.current) {
          const res = await fetch("/api/live-token");
          const data = await res.json();
          apiKeyRef.current = data.apiKey;
        }

        if (!apiKeyRef.current) {
          dropToTextMode("API key unavailable");
          return;
        }

        if (liveClientRef.current) {
          liveClientRef.current.disconnect(true);
        }

        const client = new LiveApiClient({
          onTranscriptUpdate: (role, text) => {
            if (role === "suspect") {
              addMessage(suspectIdx, {
                role: "suspect",
                content: text,
                timestamp: Date.now(),
              });
            } else {
              addMessage(suspectIdx, {
                role: "user",
                content: text,
                timestamp: Date.now(),
              });
              incrementQuestions();
            }
          },
          onConnectionChange: (connected) => {
            if (connected) {
              setLiveConnected(true);
              setLiveConnecting(false);
              setLiveError(null);
              if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);
            } else {
              // Connection dropped — fall back to text
              dropToTextMode("Connection lost. Switched to text mode.");
            }
          },
          onError: (error) => {
            console.error("Live API error:", error);
            dropToTextMode("Voice connection failed — check your API key.");
          },
          onAudioStart: () => setSuspectSpeaking(true),
          onAudioEnd: () => setSuspectSpeaking(false),
        });

        const systemPrompt = buildInterrogationSystemPrompt(
          suspect.name,
          suspect,
          SETTING_LABELS[quizAnswers.setting] || quizAnswers.setting,
          `${crimeCase.victim.name} was found dead at ${crimeCase.location}. Cause of death: ${crimeCase.causeOfDeath}. Time: ${crimeCase.timeOfDeath}.`
        );

        await client.connect(apiKeyRef.current, systemPrompt, suspectIdx, suspect.gender ?? "male");
        liveClientRef.current = client;

        // If setupComplete hasn't arrived in 10 seconds, give up
        setupTimeoutRef.current = setTimeout(() => {
          if (!liveClientRef.current?.connected) {
            dropToTextMode("Connection timed out. Switched to text mode.");
          }
        }, 10000);

      } catch (error) {
        console.error("Failed to connect Live API:", error);
        dropToTextMode("Failed to start voice mode.");
      }
    },
    [crimeCase, quizAnswers, addMessage, incrementQuestions, dropToTextMode]
  );

  useEffect(() => {
    return () => {
      if (liveClientRef.current) {
        liveClientRef.current.disconnect();
      }
      if (setupTimeoutRef.current) {
        clearTimeout(setupTimeoutRef.current);
      }
    };
  }, []);

  const handleSwitchSuspect = useCallback(
    (index: number) => {
      switchSuspect(index);
      if (voiceMode === "live") {
        connectLiveApi(index);
      }
    },
    [switchSuspect, voiceMode, connectLiveApi]
  );

  const toggleVoiceMode = useCallback(async () => {
    if (voiceMode === "text") {
      setVoiceMode("live");
      await connectLiveApi(interrogation.currentSuspectIndex);
    } else {
      setVoiceMode("text");
      if (liveClientRef.current) {
        liveClientRef.current.disconnect();
      }
      setLiveConnected(false);
    }
  }, [voiceMode, connectLiveApi, interrogation.currentSuspectIndex]);

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !crimeCase || !currentSuspect || !quizAnswers)
        return;

      if (voiceMode === "live" && liveClientRef.current?.connected) {
        liveClientRef.current.sendText(text.trim());
        addMessage(interrogation.currentSuspectIndex, {
          role: "user",
          content: text.trim(),
          timestamp: Date.now(),
        });
        incrementQuestions();
        setInput("");
        return;
      }

      const userMsg = {
        role: "user" as const,
        content: text.trim(),
        timestamp: Date.now(),
      };
      addMessage(interrogation.currentSuspectIndex, userMsg);
      incrementQuestions();
      setInput("");
      setLoading(true);

      try {
        const historyForApi = currentChat.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/interrogate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            suspectData: currentSuspect,
            setting:
              SETTING_LABELS[quizAnswers.setting] || quizAnswers.setting,
            crimeContext: `${crimeCase.victim.name} was found dead at ${crimeCase.location}. Cause of death: ${crimeCase.causeOfDeath}. Time: ${crimeCase.timeOfDeath}.`,
            chatHistory: historyForApi,
            userMessage: text.trim(),
          }),
        });

        const data = await res.json();
        addMessage(interrogation.currentSuspectIndex, {
          role: "suspect",
          content: data.response || data.error || "...",
          timestamp: Date.now(),
        });
      } catch {
        addMessage(interrogation.currentSuspectIndex, {
          role: "suspect",
          content: "*looks away silently*",
          timestamp: Date.now(),
        });
      }

      setLoading(false);
    },
    [
      crimeCase,
      currentSuspect,
      quizAnswers,
      currentChat,
      voiceMode,
      interrogation.currentSuspectIndex,
      addMessage,
      incrementQuestions,
    ]
  );

  const handleMicDown = useCallback(() => {
    if (voiceMode === "live" && liveClientRef.current?.connected) {
      liveClientRef.current.startRecording();
      setIsRecording(true);
    }
  }, [voiceMode]);

  const handleMicUp = useCallback(() => {
    if (liveClientRef.current) {
      liveClientRef.current.stopRecording();
    }
    setIsRecording(false);
  }, []);

  // Cmd (Mac) hold-to-speak shortcut
  useEffect(() => {
    if (voiceMode !== "live") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" && !e.repeat) {
        handleMicDown();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        handleMicUp();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [voiceMode, handleMicDown, handleMicUp]);

  if (!crimeCase || !currentSuspect) return null;

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex">
      {/* Left sidebar */}
      <div className="w-80 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800 flex-shrink-0">
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
                <div className="flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-red-500 rounded-full animate-pulse"
                      style={{
                        height: `${8 + Math.random() * 12}px`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-red-500 font-mono text-[10px] ml-1">
                  SPEAKING
                </span>
              </div>
            )}
          </div>
          <h3 className="text-gray-200 font-mono text-lg mb-1">
            {currentSuspect.name}
          </h3>
          <p className="text-gray-600 text-xs font-mono mb-2">
            {currentSuspect.occupation}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-600 animate-pulse" />
            <span className="text-yellow-700 text-xs font-mono">
              {currentSuspect.personality.split(".")[0]}
            </span>
          </div>
        </div>

        {/* Suspect switcher */}
        <div className="p-4 border-b border-gray-800 flex-shrink-0">
          <p className="text-gray-600 font-mono text-xs tracking-wider mb-3">
            SWITCH SUSPECT:
          </p>
          <div className="flex gap-2">
            {crimeCase.suspects.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSwitchSuspect(i)}
                className={`flex-1 py-2 px-3 font-mono text-xs border transition-all cursor-pointer ${
                  i === interrogation.currentSuspectIndex
                    ? "border-red-800 text-red-500 bg-red-500/10"
                    : "border-gray-800 text-gray-500 hover:border-gray-700"
                }`}
              >
                {s.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Voice mode toggle */}
        <div className="p-4 border-b border-gray-800 flex-shrink-0">
          <p className="text-gray-600 font-mono text-xs tracking-wider mb-3">
            INTERROGATION MODE:
          </p>
          <div className="flex gap-2">
            <button
              onClick={toggleVoiceMode}
              disabled={liveConnecting}
              className={`flex-1 py-2 px-3 font-mono text-xs border transition-all cursor-pointer ${
                voiceMode === "text"
                  ? "border-red-800 text-red-500 bg-red-500/10"
                  : "border-gray-800 text-gray-500 hover:border-gray-700"
              }`}
            >
              TEXT
            </button>
            <button
              onClick={toggleVoiceMode}
              disabled={liveConnecting}
              className={`flex-1 py-2 px-3 font-mono text-xs border transition-all cursor-pointer ${
                voiceMode === "live"
                  ? "border-red-800 text-red-500 bg-red-500/10"
                  : "border-gray-800 text-gray-500 hover:border-gray-700"
              }`}
            >
              {liveConnecting ? "..." : "VOICE"}
            </button>
          </div>
          {voiceMode === "live" && !liveError && (
            <div className="mt-2 flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  liveConnected ? "bg-green-500" : "bg-yellow-600 animate-pulse"
                }`}
              />
              <span className="text-gray-600 font-mono text-[10px]">
                {liveConnected ? "LIVE CONNECTION ACTIVE" : "CONNECTING..."}
              </span>
            </div>
          )}
          {liveError && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-red-700 font-mono text-[10px]">{liveError}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-600 font-mono text-xs tracking-wider">
              MY CLUE NOTES
            </p>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="text-gray-600 text-xs hover:text-gray-400 cursor-pointer"
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

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-red-500 font-mono text-xs tracking-[0.2em]">
              INTERROGATING:
            </span>
            <span className="text-gray-300 font-mono text-sm ml-3">
              {currentSuspect.name}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 font-mono text-xs">
              {interrogation.questionsAsked} questions asked
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentChat.length === 0 && (
            <div className="text-center text-gray-700 font-mono text-sm py-12">
              <p className="mb-2">The suspect sits across from you.</p>
              <p className="text-xs text-gray-800">
                {voiceMode === "live"
                  ? "Hold the mic button or ⌘ to speak..."
                  : "Ask your first question..."}
              </p>
            </div>
          )}

          {currentChat.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-red-900/20 border border-red-900/30"
                    : "bg-gray-900/50 border border-gray-800"
                } px-4 py-3 text-sm`}
              >
                <p className="text-gray-600 font-mono text-xs mb-1">
                  {msg.role === "user"
                    ? "▸ You:"
                    : `▸ ${currentSuspect.name}:`}
                </p>
                <p
                  className={
                    msg.role === "user" ? "text-gray-300" : "text-gray-400"
                  }
                >
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-900/50 border border-gray-800 px-4 py-3">
                <p className="text-gray-600 font-mono text-xs mb-1">
                  ▸ {currentSuspect.name}:
                </p>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendTextMessage(input)
              }
              placeholder={
                voiceMode === "live"
                  ? "Type or hold mic to speak..."
                  : "Ask your question..."
              }
              className="flex-1 bg-gray-900/50 border border-gray-800 text-gray-300 px-4 py-3 font-mono text-sm
                         focus:outline-none focus:border-gray-700 placeholder:text-gray-700"
              disabled={loading}
            />
            {voiceMode === "live" ? (
              <button
                onMouseDown={handleMicDown}
                onMouseUp={handleMicUp}
                onMouseLeave={handleMicUp}
                onTouchStart={handleMicDown}
                onTouchEnd={handleMicUp}
                disabled={!liveConnected}
                className={`px-6 py-3 border font-mono text-sm transition-all cursor-pointer ${
                  isRecording
                    ? "border-red-500 text-red-500 bg-red-500/20 animate-pulse"
                    : liveConnected
                      ? "border-gray-800 text-gray-400 hover:border-red-800/60"
                      : "border-gray-800 text-gray-700 cursor-not-allowed"
                }`}
              >
                {isRecording ? "🎤 RECORDING..." : "🎤 HOLD  /  ⌘"}
              </button>
            ) : (
              <button
                onClick={() => sendTextMessage(input)}
                disabled={!input.trim() || loading}
                className="px-6 py-3 border border-gray-800 text-gray-400 font-mono text-sm
                           hover:border-red-800/60 hover:text-gray-200 transition-all
                           disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                SEND
              </button>
            )}
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => setScreen("accusation")}
              className="px-8 py-3 border border-red-800/50 text-red-500 font-mono text-xs tracking-[0.2em]
                         hover:bg-red-500/10 hover:border-red-500/80 transition-all cursor-pointer"
            >
              🔒 MAKE ACCUSATION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
