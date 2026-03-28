"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";

export default function AccusationScreen() {
  const { crimeCase, quizAnswers, makeAccusation, setScreen } = useGameStore();
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [visible] = useState(true);

  if (!crimeCase || !quizAnswers) return null;

  return (
    <div className="fixed inset-0 bg-[#060608] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-red-950/25 via-amber-950/5 to-transparent" />

      <div
        className={`relative z-10 max-w-3xl w-full px-8 text-center transition-all duration-1000 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <p className="text-amber-900/70 font-mono text-[10px] tracking-[0.45em] mb-4 uppercase">
          Sherlock AI · verdict
        </p>
        <p className="text-gray-500 font-mono text-xs tracking-[0.25em] mb-8">
          DETECTIVE {quizAnswers.detectiveName.toUpperCase()}
        </p>

        <h2 className="font-display text-2xl md:text-3xl text-amber-100/90 font-normal mb-2 tracking-wide">
          The evidence has been heard.
        </h2>
        <p className="text-gray-500 text-base md:text-lg mb-2">
          You have looked them in the eye.
        </p>
        <p className="text-lg md:text-xl text-red-600/90 font-display mb-12 tracking-wide">
          Name your suspect.
        </p>

        <div
          className={`grid gap-6 mb-12 ${
            crimeCase.suspects.length === 2
              ? "grid-cols-2 max-w-lg mx-auto"
              : "grid-cols-3"
          }`}
        >
          {crimeCase.suspects.map((suspect, i) => (
            <button
              key={i}
              onClick={() => setConfirmIndex(i)}
              className="group border border-gray-800 hover:border-red-800/60 p-6 transition-all
                         hover:bg-red-500/5 cursor-pointer"
            >
              <div className="w-full aspect-square bg-gray-900 mb-4 flex items-center justify-center overflow-hidden">
                {suspect.portraitUrl ? (
                  <img
                    src={suspect.portraitUrl}
                    alt={suspect.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <span className="text-5xl opacity-50 group-hover:opacity-80 transition-opacity">
                    {["👤", "🧑", "👩"][i % 3]}
                  </span>
                )}
              </div>
              <h4 className="text-gray-300 font-mono text-sm mb-2">
                {suspect.name}
              </h4>
              <p className="text-red-700 font-mono text-xs tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                IT&apos;S THEM
              </p>
            </button>
          ))}
        </div>

        <p className="text-gray-700 text-sm font-mono flex items-center justify-center gap-2">
          <span className="text-yellow-700">⚠️</span>
          Choose carefully. There&apos;s no going back.
        </p>

        <button
          onClick={() => setScreen("investigation")}
          className="mt-6 text-gray-700 text-xs font-mono hover:text-gray-500 transition-colors cursor-pointer"
        >
          ← Back to interrogation
        </button>
      </div>

      {confirmIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d0d12] border border-gray-800 p-8 max-w-md w-full mx-4 text-center">
            <p className="text-gray-300 font-mono text-lg mb-2">
              You&apos;re accusing{" "}
              <span className="text-red-500">
                {crimeCase.suspects[confirmIndex].name}
              </span>
              .
            </p>
            <p className="text-gray-600 text-sm mb-8">Are you sure?</p>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setConfirmIndex(null)}
                className="px-8 py-3 border border-gray-800 text-gray-500 font-mono text-sm
                           hover:border-gray-700 transition-all cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={() => makeAccusation(confirmIndex)}
                className="px-8 py-3 border border-red-800 text-red-500 font-mono text-sm
                           hover:bg-red-500/20 transition-all cursor-pointer"
              >
                🔒 LOCK THEM UP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
