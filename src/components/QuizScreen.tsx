"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import type { Setting, QuizAnswers } from "@/types/game";

const SETTINGS: { id: Setting; emoji: string; label: string }[] = [
  { id: "noir-city", emoji: "🏙️", label: "Noir City" },
  { id: "medieval-castle", emoji: "🏰", label: "Medieval Castle" },
  { id: "space-station", emoji: "🚀", label: "Space Station" },
  { id: "small-town", emoji: "🏡", label: "Small Town" },
];

export default function QuizScreen() {
  const { setScreen, setQuizAnswers } = useGameStore();
  const [step, setStep] = useState(0);
  const [setting, setSetting] = useState<Setting | null>(null);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [suspectCount, setSuspectCount] = useState<2 | 3 | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [fadeIn, setFadeIn] = useState(true);

  function nextStep() {
    setFadeIn(false);
    setTimeout(() => {
      setStep((s) => s + 1);
      setFadeIn(true);
    }, 400);
  }

  function handleFinish(count: 2 | 3) {
    setSuspectCount(count);
    setTransitioning(true);

    const answers: QuizAnswers = {
      setting: setting!,
      detectiveName: name,
      personalDetail: detail,
      suspectCount: count,
    };

    setTimeout(() => {
      setQuizAnswers(answers);
      setScreen("loading");
    }, 1500);
  }

  if (transitioning) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="glitch-overlay" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#060608] flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/15 via-transparent to-black/60 pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.07]">
        <div className="absolute top-1/4 left-1/4 w-px h-40 bg-amber-800/80 blur-sm rotate-12" />
        <div className="absolute top-1/3 right-1/3 w-px h-28 bg-amber-900/60 blur-sm -rotate-6" />
      </div>

      <div
        className={`relative z-10 w-full max-w-2xl px-6 md:px-10 transition-all duration-500 ${
          fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <header className="mb-10 text-center border-b border-amber-900/25 pb-6">
          <p className="font-display text-lg md:text-xl tracking-[0.2em] text-amber-100/90 mb-1">
            Sherlock AI
          </p>
          <p className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-gray-600 uppercase">
            Confidential dossier · intake
          </p>
        </header>

        <div className="text-gray-500 font-mono text-xs tracking-[0.35em] mb-8 uppercase">
          Dossier {step + 1} / 4
        </div>

        {step === 0 && (
          <div className="dossier-panel rounded-sm p-8 md:p-10">
            <h2 className="font-display text-2xl md:text-3xl text-amber-100/90 font-normal mb-10 leading-snug">
              &ldquo;Where did this happen?&rdquo;
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {SETTINGS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSetting(s.id);
                    nextStep();
                  }}
                  className={`group p-6 border border-gray-800 hover:border-red-800/60 transition-all duration-300
                             text-left hover:bg-red-500/5 cursor-pointer`}
                >
                  <span className="text-2xl mb-2 block">{s.emoji}</span>
                  <span className="text-gray-400 group-hover:text-gray-200 font-mono text-sm tracking-wider transition-colors">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="dossier-panel rounded-sm p-8 md:p-10">
            <h2 className="font-display text-2xl md:text-3xl text-amber-100/90 font-normal mb-10 leading-snug">
              &ldquo;What&apos;s your name, Detective?&rdquo;
            </h2>
            <div className="flex flex-col gap-6">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full bg-transparent border-b border-gray-700 text-white text-xl py-3
                           focus:outline-none focus:border-red-800 transition-colors font-mono
                           placeholder:text-gray-700"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && name.trim() && nextStep()}
              />
              <button
                onClick={nextStep}
                disabled={!name.trim()}
                className="self-end px-8 py-3 border border-gray-800 text-gray-400 font-mono text-sm
                           tracking-wider hover:border-red-800/60 hover:text-gray-200 hover:bg-red-500/5
                           transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                NEXT →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="dossier-panel rounded-sm p-8 md:p-10">
            <h2 className="font-display text-2xl md:text-3xl text-amber-100/90 font-normal mb-2 leading-snug">
              &ldquo;Tell me one thing about yourself.&rdquo;
            </h2>
            <p className="text-gray-500 text-sm mb-10 italic border-l-2 border-amber-900/40 pl-4">
              A detail that will follow you into the fog — we weave it through your case.
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Your city, job, or a hobby..."
                className="w-full bg-transparent border-b border-gray-700 text-white text-xl py-3
                           focus:outline-none focus:border-red-800 transition-colors font-mono
                           placeholder:text-gray-700"
                autoFocus
                onKeyDown={(e) =>
                  e.key === "Enter" && detail.trim() && nextStep()
                }
              />
              <p className="text-gray-700 text-xs font-mono">
                your city, job, or a hobby
              </p>
              <button
                onClick={nextStep}
                disabled={!detail.trim()}
                className="self-end mt-4 px-8 py-3 border border-gray-800 text-gray-400 font-mono text-sm
                           tracking-wider hover:border-red-800/60 hover:text-gray-200 hover:bg-red-500/5
                           transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                NEXT →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="dossier-panel rounded-sm p-8 md:p-10">
            <h2 className="font-display text-2xl md:text-3xl text-amber-100/90 font-normal mb-10 leading-snug">
              &ldquo;How many suspects are you ready to handle?&rdquo;
            </h2>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => handleFinish(2)}
                className="p-6 border border-gray-800 hover:border-red-800/60 transition-all duration-300
                           text-left hover:bg-red-500/5 cursor-pointer group"
              >
                <span className="text-gray-400 group-hover:text-gray-200 font-mono tracking-wider">
                  2 — Keep it clean
                </span>
              </button>
              <button
                onClick={() => handleFinish(3)}
                className="p-6 border border-gray-800 hover:border-red-800/60 transition-all duration-300
                           text-left hover:bg-red-500/5 cursor-pointer group"
              >
                <span className="text-gray-400 group-hover:text-gray-200 font-mono tracking-wider">
                  3 — Bring them all in
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
