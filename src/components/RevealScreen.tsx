"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";

export default function RevealScreen() {
  const {
    crimeCase,
    quizAnswers,
    isCorrect,
    accusedSuspectIndex,
    interrogation,
    reset,
  } = useGameStore();
  const [phase, setPhase] = useState<"flash" | "reveal">("flash");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("reveal"), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!crimeCase || !quizAnswers || accusedSuspectIndex === null) return null;

  const accusedSuspect = crimeCase.suspects[accusedSuspectIndex];
  const guiltyIndex = crimeCase.suspects.findIndex((s) => s.isGuilty);
  const guiltySuspect = crimeCase.suspects[guiltyIndex];

  const timeSpent = Math.round(
    (Date.now() - interrogation.startTime) / 60000
  );

  if (phase === "flash") {
    return (
      <div
        className={`fixed inset-0 ${
          isCorrect ? "bg-green-500" : "bg-red-600"
        } flex items-center justify-center animate-flash`}
      >
        <div className="text-white text-6xl font-mono font-bold">
          {isCorrect ? "CASE CLOSED" : "WRONG"}
        </div>
      </div>
    );
  }

  if (isCorrect) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] overflow-y-auto">
        <div className="max-w-2xl mx-auto py-16 px-6 text-center">
          <div className="relative inline-block mb-8">
            <div className="text-green-500 font-mono text-6xl font-bold tracking-wider rotate-[-5deg] border-4 border-green-500 px-8 py-4">
              CASE CLOSED
            </div>
          </div>

          <h2 className="text-3xl text-gray-200 font-light mb-8">
            YOU GOT IT, DETECTIVE {quizAnswers.detectiveName.toUpperCase()}.
          </h2>

          <p className="text-xl text-gray-400 mb-8">
            <span className="text-red-500">{guiltySuspect.name}</span> did it.
          </p>

          <div className="border border-gray-800 bg-gray-900/30 p-8 mb-8 text-left">
            <p className="text-gray-600 font-mono text-xs tracking-wider mb-4">
              HERE&apos;S WHAT REALLY HAPPENED:
            </p>
            <p className="text-gray-300 leading-relaxed italic">
              &ldquo;{crimeCase.trueStory}&rdquo;
            </p>
          </div>

          <div className="border border-gray-800 p-6 mb-10 text-left">
            <p className="text-gray-600 font-mono text-xs tracking-wider mb-2">
              THE CLUE THAT SHOULD HAVE TOLD YOU:
            </p>
            <p className="text-yellow-600 text-sm">
              → {crimeCase.keyClueCallback}
            </p>
          </div>

          <div className="flex justify-center gap-8 mb-10 text-gray-500 font-mono text-sm">
            <div>
              <span className="text-2xl block text-green-500">🏆</span>
              CASE SOLVED IN {timeSpent} MIN
            </div>
            <div>
              <span className="text-2xl block text-green-500">🎤</span>
              {interrogation.questionsAsked} QUESTIONS ASKED
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={reset}
              className="px-8 py-3 border border-green-800/50 text-green-500 font-mono text-sm tracking-wider
                         hover:bg-green-500/10 transition-all cursor-pointer"
            >
              PLAY AGAIN
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `I solved CrimeScene.AI Case #${crimeCase.caseNumber} in ${timeSpent} minutes with ${interrogation.questionsAsked} questions! Can you do better?`
                );
              }}
              className="px-8 py-3 border border-gray-800 text-gray-400 font-mono text-sm tracking-wider
                         hover:border-gray-700 transition-all cursor-pointer"
            >
              SHARE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a0808] overflow-y-auto">
      <div className="max-w-2xl mx-auto py-16 px-6 text-center">
        <div className="relative inline-block mb-8">
          <div className="text-4xl mb-4">💀</div>
          <div className="crack-effect" />
        </div>

        <h2 className="text-3xl text-gray-200 font-light mb-6">
          WRONG, DETECTIVE {quizAnswers.detectiveName.toUpperCase()}.
        </h2>

        <p className="text-gray-400 mb-2">
          <span className="text-gray-300">{accusedSuspect.name}</span> watches
          you from across the room.
        </p>
        <p className="text-gray-500 mb-8">
          They&apos;re innocent. You just let the real killer walk.
        </p>

        <p className="text-xl text-red-500 mb-8">
          It was <span className="font-bold">{guiltySuspect.name}</span> all
          along.
        </p>

        <div className="border border-gray-800 bg-gray-900/30 p-8 mb-8 text-left">
          <p className="text-gray-600 font-mono text-xs tracking-wider mb-4">
            HERE&apos;S HOW THE CRIME REALLY HAPPENED:
          </p>
          <p className="text-gray-300 leading-relaxed italic">
            &ldquo;{crimeCase.trueStory}&rdquo;
          </p>
        </div>

        <div className="border border-red-900/30 p-6 mb-10 text-left">
          <p className="text-gray-600 font-mono text-xs tracking-wider mb-2">
            THE CLUE YOU MISSED:
          </p>
          <p className="text-red-500 text-sm">
            → {crimeCase.keyClueCallback}
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-8 py-3 border border-red-800/50 text-red-500 font-mono text-sm tracking-wider
                       hover:bg-red-500/10 transition-all cursor-pointer"
          >
            TRY AGAIN
          </button>
          <button
            onClick={reset}
            className="px-8 py-3 border border-gray-800 text-gray-400 font-mono text-sm tracking-wider
                       hover:border-gray-700 transition-all cursor-pointer"
          >
            NEW CASE
          </button>
        </div>
      </div>
    </div>
  );
}
