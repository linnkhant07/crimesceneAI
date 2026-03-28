"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { LiveApiClient } from "@/lib/liveApiClient";
import { buildDetectiveHayesPrompt } from "@/lib/prompts";
import type { TaggedClue } from "@/types/game";

interface CrimeSceneTabProps {
  taggedClues: TaggedClue[];
  onTagClue: (clue: TaggedClue) => void;
}

export default function CrimeSceneTab({ taggedClues, onTagClue }: CrimeSceneTabProps) {
  const { crimeCase, quizAnswers, crimeSceneImages, interrogation, updateNotes } = useGameStore();

  const [imageIndex, setImageIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [hayesConnected, setHayesConnected] = useState(false);
  const [hayesConnecting, setHayesConnecting] = useState(false);
  const [hayesError, setHayesError] = useState<string | null>(null);
  const [hayesSpeaking, setHayesSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<{ role: "user" | "hayes"; text: string }[]>([]);
  const [showNotes, setShowNotes] = useState(false);

  const liveClientRef = useRef<LiveApiClient | null>(null);
  const apiKeyRef = useRef<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const prevImageIndexRef = useRef(imageIndex);

  const SETTING_LABELS: Record<string, string> = {
    "noir-city": "a 1940s noir city",
    "medieval-castle": "a medieval castle",
    "space-station": "a deep-space station",
    "small-town": "a quiet small town",
  };

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Notify Hayes when image changes
  useEffect(() => {
    if (prevImageIndexRef.current === imageIndex) return;
    prevImageIndexRef.current = imageIndex;
    if (liveClientRef.current?.connected) {
      liveClientRef.current.sendText(
        `Player is now on Image ${imageIndex + 1}${crimeSceneImages[imageIndex]?.description ? `: ${crimeSceneImages[imageIndex].description}` : ""}.`
      );
    }
  }, [imageIndex, crimeSceneImages]);

  const connectHayes = useCallback(async () => {
    if (!crimeCase || !quizAnswers) return;

    setHayesConnecting(true);
    setHayesConnected(false);
    setHayesError(null);

    try {
      if (!apiKeyRef.current) {
        const res = await fetch("/api/live-token");
        const data = await res.json();
        apiKeyRef.current = data.apiKey;
      }
      if (!apiKeyRef.current) {
        setHayesError("API key unavailable");
        setHayesConnecting(false);
        return;
      }

      if (liveClientRef.current) liveClientRef.current.disconnect(true);

      const client = new LiveApiClient({
        onTranscriptUpdate: (role, text) => {
          setTranscript((prev) => [
            ...prev,
            { role: role === "user" ? "user" : "hayes", text },
          ]);
        },
        onConnectionChange: (connected) => {
          if (connected) {
            setHayesConnected(true);
            setHayesConnecting(false);
            setHayesError(null);
          } else {
            setHayesConnected(false);
            setHayesConnecting(false);
          }
        },
        onError: (err) => {
          console.error("Hayes Live API error:", err);
          setHayesError("Voice connection failed");
          setHayesConnecting(false);
        },
        onAudioStart: () => setHayesSpeaking(true),
        onAudioEnd: () => setHayesSpeaking(false),
      });

      const systemPrompt = buildDetectiveHayesPrompt(
        crimeCase,
        SETTING_LABELS[quizAnswers.setting] ?? quizAnswers.setting,
        crimeSceneImages
      );

      // Hayes always uses voice index 0 → "Charon" (deep authoritative male)
      await client.connect(apiKeyRef.current, systemPrompt, 0, "male");
      liveClientRef.current = client;
    } catch (err) {
      console.error("Failed to connect Hayes:", err);
      setHayesError("Failed to start voice mode");
      setHayesConnecting(false);
    }
  }, [crimeCase, quizAnswers, crimeSceneImages]);

  // Connect on mount
  useEffect(() => {
    connectHayes();
    return () => {
      liveClientRef.current?.disconnect(true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMicDown = useCallback(() => {
    if (liveClientRef.current?.connected) {
      liveClientRef.current.startRecording();
      setIsRecording(true);
    }
  }, []);

  const handleMicUp = useCallback(() => {
    liveClientRef.current?.stopRecording();
    setIsRecording(false);
  }, []);

  // ⌘ hold-to-speak
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Meta" && !e.repeat) handleMicDown(); };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === "Meta") handleMicUp(); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleMicDown, handleMicUp]);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = imageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const newClue: TaggedClue = {
        id: Date.now(),
        imageIndex,
        x,
        y,
      };
      onTagClue(newClue);
      // Tell Hayes about the tag
      if (liveClientRef.current?.connected) {
        liveClientRef.current.sendText(
          `The detective just tagged a clue location on Image ${imageIndex + 1} at position (${Math.round(x)}%, ${Math.round(y)}%).`
        );
      }
    },
    [imageIndex, onTagClue]
  );

  const currentImageClues = taggedClues.filter((c) => c.imageIndex === imageIndex);
  const totalClues = taggedClues.length;
  const currentImage = crimeSceneImages[imageIndex];

  return (
    <div className="fixed inset-0 top-10 bg-[#0a0a0f] flex">
      {/* Left panel — image viewer */}
      <div className="flex-1 flex flex-col border-r border-gray-800 overflow-hidden">
        {/* Image + nav */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <span className="text-gray-600 font-mono text-xs tracking-widest">
              IMAGE {imageIndex + 1} OF {Math.max(crimeSceneImages.length, 1)}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-700 animate-pulse" />
              <span className="text-gray-700 font-mono text-xs">CLICK IMAGE TO TAG CLUE</span>
            </div>
          </div>

          {/* Image container */}
          <div
            ref={imageRef}
            onClick={handleImageClick}
            className="relative w-full flex-1 bg-gray-900 border border-gray-800 cursor-crosshair overflow-hidden"
            style={{ minHeight: 0 }}
          >
            {currentImage?.url ? (
              <img
                src={currentImage.url}
                alt={`Crime scene ${imageIndex + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-gray-700 font-mono text-xs tracking-widest">
                  {crimeSceneImages.length === 0 ? "GENERATING CRIME SCENE..." : "NO IMAGE"}
                </p>
              </div>
            )}

            {/* Clue pins on current image */}
            {currentImageClues.map((clue, i) => (
              <div
                key={clue.id}
                className="absolute w-6 h-6 rounded-full bg-red-600 border-2 border-white flex items-center justify-center pointer-events-none"
                style={{
                  left: `${clue.x}%`,
                  top: `${clue.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 10,
                }}
              >
                <span className="text-white text-[10px] font-bold font-mono">{i + 1}</span>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-3 flex-shrink-0">
            <button
              onClick={() => setImageIndex((i) => Math.max(0, i - 1))}
              disabled={imageIndex === 0}
              className="px-4 py-2 border border-gray-800 text-gray-500 font-mono text-xs
                         hover:border-gray-600 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              ← PREV
            </button>

            <div className="text-center">
              <p className="text-gray-600 font-mono text-xs">
                CLUES TAGGED: <span className="text-red-500">{totalClues}</span>
              </p>
              {currentImage?.description && (
                <p className="text-gray-700 font-mono text-[10px] mt-0.5 max-w-xs truncate">
                  {currentImage.description}
                </p>
              )}
            </div>

            <button
              onClick={() => setImageIndex((i) => Math.min(Math.max(crimeSceneImages.length - 1, 0), i + 1))}
              disabled={imageIndex >= Math.max(crimeSceneImages.length - 1, 0)}
              className="px-4 py-2 border border-gray-800 text-gray-500 font-mono text-xs
                         hover:border-gray-600 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              NEXT →
            </button>
          </div>
        </div>

        {/* Tagged clues list */}
        {taggedClues.length > 0 && (
          <div className="border-t border-gray-800 p-4 flex-shrink-0 max-h-36 overflow-y-auto">
            <p className="text-gray-600 font-mono text-xs tracking-widest mb-2">TAGGED LOCATIONS</p>
            <div className="space-y-1">
              {taggedClues.map((clue, i) => (
                <div key={clue.id} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-300 text-[9px] font-bold">{i + 1}</span>
                  </div>
                  <span className="text-gray-500 font-mono text-xs">
                    Image {clue.imageIndex + 1} — ({Math.round(clue.x)}%, {Math.round(clue.y)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="border-t border-gray-800 p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 font-mono text-xs tracking-widest">MY CLUE NOTES</p>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="text-gray-600 text-xs hover:text-gray-400 cursor-pointer font-mono"
            >
              {showNotes ? "hide" : "show"}
            </button>
          </div>
          {showNotes && (
            <textarea
              value={interrogation.notes}
              onChange={(e) => updateNotes(e.target.value)}
              placeholder="Jot down your thoughts..."
              className="w-full h-20 bg-gray-900/50 border border-gray-800 text-gray-400 text-xs p-2
                         focus:outline-none focus:border-gray-700 resize-none font-mono"
            />
          )}
        </div>
      </div>

      {/* Right panel — Detective Hayes */}
      <div className="w-96 flex flex-col border-l border-gray-800">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-gray-200 font-mono text-sm tracking-wider">DET. HAYES</h3>
            <p className="text-gray-600 font-mono text-xs">DETECTIVE PARTNER</p>
          </div>
          <div className="flex items-center gap-2">
            {hayesSpeaking ? (
              <>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-0.5 h-3 bg-red-500 rounded-full animate-pulse"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <span className="text-red-500 font-mono text-[10px]">SPEAKING</span>
              </>
            ) : hayesConnecting ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-600 animate-pulse" />
                <span className="text-yellow-700 font-mono text-[10px]">CONNECTING...</span>
              </>
            ) : hayesConnected ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-green-700 font-mono text-[10px]">LIVE</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-red-700" />
                <span className="text-red-700 font-mono text-[10px]">
                  {hayesError ?? "OFFLINE"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {transcript.length === 0 && (
            <p className="text-gray-700 font-mono text-xs text-center py-8">
              {hayesConnecting
                ? "Connecting to Hayes..."
                : "Hayes is waiting. Hold the mic to speak."}
            </p>
          )}
          {transcript.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-3 py-2 text-xs font-mono ${
                  msg.role === "user"
                    ? "bg-red-900/20 border border-red-900/30 text-gray-300"
                    : "bg-gray-900/50 border border-gray-800 text-gray-400"
                }`}
              >
                <p className="text-gray-600 text-[10px] mb-0.5">
                  {msg.role === "user" ? "▸ You:" : "▸ Hayes:"}
                </p>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>

        {/* Mic */}
        <div className="p-4 border-t border-gray-800 flex-shrink-0">
          <button
            onMouseDown={handleMicDown}
            onMouseUp={handleMicUp}
            onMouseLeave={handleMicUp}
            onTouchStart={handleMicDown}
            onTouchEnd={handleMicUp}
            disabled={!hayesConnected}
            className={`w-full py-3 border font-mono text-sm transition-all cursor-pointer ${
              isRecording
                ? "border-red-500 text-red-500 bg-red-500/20 animate-pulse"
                : hayesConnected
                  ? "border-gray-800 text-gray-400 hover:border-red-800/60"
                  : "border-gray-800 text-gray-700 cursor-not-allowed"
            }`}
          >
            {isRecording ? "🎤 RECORDING..." : "🎤 HOLD TO SPEAK  /  ⌘"}
          </button>
          {hayesError && (
            <button
              onClick={connectHayes}
              className="w-full mt-2 py-2 border border-gray-800 text-gray-600 font-mono text-xs
                         hover:border-gray-600 hover:text-gray-400 transition-all cursor-pointer"
            >
              RECONNECT HAYES
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
