"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";

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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const currentSuspect =
    crimeCase?.suspects[interrogation.currentSuspectIndex];
  const currentChat =
    interrogation.chatHistories[interrogation.currentSuspectIndex] || [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !crimeCase || !currentSuspect || !quizAnswers)
        return;

      const settingLabels: Record<string, string> = {
        "noir-city": "a 1940s noir city",
        "medieval-castle": "a medieval castle",
        "space-station": "a deep-space station",
        "small-town": "a quiet small town",
      };

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
            setting: settingLabels[quizAnswers.setting] || quizAnswers.setting,
            crimeContext: `${crimeCase.victim.name} was found dead at ${crimeCase.location}. Cause of death: ${crimeCase.causeOfDeath}. Time: ${crimeCase.timeOfDeath}.`,
            chatHistory: historyForApi,
            userMessage: text.trim(),
          }),
        });

        const data = await res.json();
        const suspectMsg = {
          role: "suspect" as const,
          content: data.response || data.error || "...",
          timestamp: Date.now(),
        };
        addMessage(interrogation.currentSuspectIndex, suspectMsg);
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
      interrogation.currentSuspectIndex,
      addMessage,
      incrementQuestions,
    ]
  );

  function startVoiceRecording() {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      sendMessage(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function stopVoiceRecording() {
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  if (!crimeCase || !currentSuspect) return null;

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex">
      <div className="w-80 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800 flex-shrink-0">
          <div className="w-full aspect-square bg-gray-900 mb-4 flex items-center justify-center rounded-sm">
            <span className="text-6xl opacity-60">
              {["👤", "🧑", "👩"][interrogation.currentSuspectIndex % 3]}
            </span>
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

        <div className="p-4 border-b border-gray-800 flex-shrink-0">
          <p className="text-gray-600 font-mono text-xs tracking-wider mb-3">
            SWITCH SUSPECT:
          </p>
          <div className="flex gap-2">
            {crimeCase.suspects.map((s, i) => (
              <button
                key={i}
                onClick={() => switchSuspect(i)}
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
                Ask your first question...
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
                    ? `▸ You:`
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
                  <div
                    className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage(input)
              }
              placeholder="Ask your question..."
              className="flex-1 bg-gray-900/50 border border-gray-800 text-gray-300 px-4 py-3 font-mono text-sm
                         focus:outline-none focus:border-gray-700 placeholder:text-gray-700"
              disabled={loading}
            />
            <button
              onMouseDown={startVoiceRecording}
              onMouseUp={stopVoiceRecording}
              onMouseLeave={stopVoiceRecording}
              className={`px-4 py-3 border font-mono text-sm transition-all cursor-pointer ${
                isRecording
                  ? "border-red-500 text-red-500 bg-red-500/20 animate-pulse"
                  : "border-gray-800 text-gray-500 hover:border-gray-700"
              }`}
            >
              🎤
            </button>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="px-6 py-3 border border-gray-800 text-gray-400 font-mono text-sm
                         hover:border-red-800/60 hover:text-gray-200 transition-all
                         disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              SEND
            </button>
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
