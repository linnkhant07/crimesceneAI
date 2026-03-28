"use client";

import { useState, useCallback } from "react";
import CrimeSceneTab from "@/components/CrimeSceneTab";
import InterrogationScreen from "@/components/InterrogationScreen";
import type { TaggedClue } from "@/types/game";

type InvestigationTab = "crime-scene" | "suspects";

export default function InvestigationScreen() {
  const [activeTab, setActiveTab] = useState<InvestigationTab>("crime-scene");
  const [taggedClues, setTaggedClues] = useState<TaggedClue[]>([]);
  // Only mount InterrogationScreen after the user first opens the suspects tab,
  // then keep it mounted so the Live API connection survives tab switches.
  const [suspectsEverOpened, setSuspectsEverOpened] = useState(false);

  const handleTagClue = useCallback((clue: TaggedClue) => {
    setTaggedClues((prev) => [...prev, clue]);
  }, []);

  return (
    <>
      {/* Fixed tab bar — z-50 sits above both full-screen sub-components */}
      <div className="fixed top-0 left-0 right-0 z-50 flex border-b border-amber-900/30 bg-[#060608]/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => setActiveTab("crime-scene")}
          className={`flex items-center gap-2 px-5 md:px-7 py-3 font-mono text-[10px] md:text-xs tracking-[0.18em] border-r border-amber-900/25 transition-all cursor-pointer ${
            activeTab === "crime-scene"
              ? "text-amber-200 bg-amber-950/30 border-b-2 border-b-amber-700/80"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          🔎 THE SCENE
          {taggedClues.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-red-900/40 text-red-500 text-[10px] rounded">
              {taggedClues.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab("suspects"); setSuspectsEverOpened(true); }}
          className={`flex items-center gap-2 px-5 md:px-7 py-3 font-mono text-[10px] md:text-xs tracking-[0.18em] transition-all cursor-pointer ${
            activeTab === "suspects"
              ? "text-amber-200 bg-amber-950/30 border-b-2 border-b-amber-700/80"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          👥 INTERROGATION
        </button>
      </div>

      {/* Crime Scene tab — mounted but hidden when not active so Hayes stays connected */}
      <div className={activeTab === "crime-scene" ? "block" : "hidden"}>
        <CrimeSceneTab taggedClues={taggedClues} onTagClue={handleTagClue} />
      </div>

      {/* Suspects tab — only mounted after first visit so Live API doesn't
          connect while the user is still on the crime scene tab */}
      {suspectsEverOpened && (
        <div className={activeTab === "suspects" ? "block" : "hidden"}>
          <InterrogationScreen topOffset />
        </div>
      )}
    </>
  );
}
