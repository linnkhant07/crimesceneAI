"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

const CLUE_ICONS = { obvious: "🔍", misleading: "🔍", key: "🔍" };

export default function CaseFileScreen() {
  const { crimeCase, quizAnswers, setScreen } = useGameStore();
  const [visible, setVisible] = useState(false);
  const [stampVisible, setStampVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 300);
    setTimeout(() => setStampVisible(true), 1000);
  }, []);

  if (!crimeCase || !quizAnswers) return null;

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] overflow-y-auto">
      <div
        className={`max-w-3xl mx-auto py-12 px-6 transition-all duration-1000 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="border border-gray-800 bg-[#0d0d12] relative">
          {stampVisible && (
            <div className="absolute top-4 right-4 text-red-700/40 font-mono text-xs tracking-[0.3em] border border-red-700/30 px-3 py-1 rotate-[-4deg]">
              CLASSIFIED
            </div>
          )}

          <div className="border-b border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-red-500 font-mono text-xs tracking-[0.3em] mb-1">
                  CLASSIFIED — DETECTIVE {quizAnswers.detectiveName.toUpperCase()}
                </h2>
                <p className="text-gray-600 font-mono text-xs">
                  CASE #{crimeCase.caseNumber}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 border-b border-gray-800">
            <div className="grid grid-cols-2 gap-4 font-mono text-sm">
              <div>
                <span className="text-gray-600">VICTIM: </span>
                <span className="text-gray-300">
                  {crimeCase.victim.name}, {crimeCase.victim.age}
                </span>
              </div>
              <div>
                <span className="text-gray-600">OCCUPATION: </span>
                <span className="text-gray-300">
                  {crimeCase.victim.occupation}
                </span>
              </div>
              <div>
                <span className="text-gray-600">LOCATION: </span>
                <span className="text-gray-300">{crimeCase.location}</span>
              </div>
              <div>
                <span className="text-gray-600">TIME: </span>
                <span className="text-gray-300">{crimeCase.timeOfDeath}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">CAUSE OF DEATH: </span>
                <span className="text-gray-300">{crimeCase.causeOfDeath}</span>
              </div>
            </div>
          </div>

          <div className="p-6 border-b border-gray-800">
            <h3 className="text-gray-500 font-mono text-xs tracking-[0.2em] mb-4">
              CRIME SCENE
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed italic">
              {crimeCase.crimeSceneDescription}
            </p>
          </div>

          <div className="p-6 border-b border-gray-800">
            <h3 className="text-gray-500 font-mono text-xs tracking-[0.2em] mb-4">
              EVIDENCE RECOVERED
            </h3>
            <div className="space-y-3">
              {crimeCase.clues.map((clue, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg mt-[-2px]">
                    {CLUE_ICONS[clue.type]}
                  </span>
                  <div>
                    <span className="text-gray-500 font-mono text-xs mr-2">
                      Clue {i + 1}:
                    </span>
                    <span className="text-gray-300 text-sm">{clue.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-gray-500 font-mono text-xs tracking-[0.2em] mb-6">
              PERSONS OF INTEREST
            </h3>
            <div
              className={`grid gap-4 ${
                crimeCase.suspects.length === 2 ? "grid-cols-2" : "grid-cols-3"
              }`}
            >
              {crimeCase.suspects.map((suspect, i) => (
                <div
                  key={i}
                  className="border border-gray-800 p-4 hover:border-gray-700 transition-colors"
                >
                  <div className="w-full aspect-square bg-gray-900 mb-3 flex items-center justify-center">
                    <div className="text-4xl text-gray-700">
                      {["👤", "🧑", "👩"][i % 3]}
                    </div>
                  </div>
                  <h4 className="text-gray-300 font-mono text-sm mb-1">
                    {suspect.name}
                  </h4>
                  <p className="text-gray-600 text-xs mb-2">
                    {suspect.age} · {suspect.occupation}
                  </p>
                  <p className="text-gray-500 text-xs italic">
                    {suspect.relationship}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => setScreen("interrogation")}
            className="px-12 py-4 border border-red-800/50 text-red-500 font-mono text-sm tracking-[0.3em]
                       hover:bg-red-500/10 hover:border-red-500/80 transition-all cursor-pointer uppercase"
          >
            BEGIN INTERROGATION →
          </button>
        </div>
      </div>
    </div>
  );
}
