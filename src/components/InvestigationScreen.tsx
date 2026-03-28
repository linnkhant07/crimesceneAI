"use client";

import { useState, useCallback } from "react";
import CrimeSceneTab from "@/components/CrimeSceneTab";
import InterrogationScreen from "@/components/InterrogationScreen";
import type { TaggedClue } from "@/types/game";

type InvestigationTab = "crime-scene" | "suspects";

export default function InvestigationScreen() {
  const [activeTab, setActiveTab] = useState<InvestigationTab>("crime-scene");
  const [taggedClues, setTaggedClues] = useState<TaggedClue[]>([]);

  const handleTagClue = useCallback((clue: TaggedClue) => {
    setTaggedClues((prev) => [...prev, clue]);
  }, []);

  return (
    <>
      {/* Fixed tab bar — z-50 sits above both full-screen sub-components */}
      <div className="fixed top-0 left-0 right-0 z-50 flex border-b border-gray-800 bg-[#0a0a0f]">
        <button
          onClick={() => setActiveTab("crime-scene")}
          className={`flex items-center gap-2 px-6 py-2.5 font-mono text-xs tracking-[0.2em] border-r border-gray-800 transition-all cursor-pointer ${
            activeTab === "crime-scene"
              ? "text-red-500 bg-red-500/5 border-b-2 border-b-red-700"
              : "text-gray-600 hover:text-gray-400"
          }`}
        >
          🔎 CRIME SCENE
          {taggedClues.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-red-900/40 text-red-500 text-[10px] rounded">
              {taggedClues.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("suspects")}
          className={`flex items-center gap-2 px-6 py-2.5 font-mono text-xs tracking-[0.2em] transition-all cursor-pointer ${
            activeTab === "suspects"
              ? "text-red-500 bg-red-500/5 border-b-2 border-b-red-700"
              : "text-gray-600 hover:text-gray-400"
          }`}
        >
          👥 SUSPECTS
        </button>
      </div>

      {/* Crime Scene tab — mounted but hidden when not active so Hayes stays connected */}
      <div className={activeTab === "crime-scene" ? "block" : "hidden"}>
        <CrimeSceneTab taggedClues={taggedClues} onTagClue={handleTagClue} />
      </div>

      {/* Suspects tab */}
      <div className={activeTab === "suspects" ? "block" : "hidden"}>
        <InterrogationScreen topOffset />
      </div>
    </>
  );
}
