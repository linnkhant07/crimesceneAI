"use client";

import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { LyriaClient, type WeightedPrompt } from "@/lib/lyriaClient";
import type { Screen, Setting } from "@/types/game";

const SETTING_PROMPTS: Record<Setting, WeightedPrompt[]> = {
  "noir-city": [
    { text: "1940s noir jazz, haunting piano, rain-slicked streets, cigarette smoke, saxophone, atmospheric mystery", weight: 1.0 },
  ],
  "medieval-castle": [
    { text: "dark medieval orchestral, haunting strings, candlelit stone corridors, ominous lute, ancient mystery", weight: 1.0 },
  ],
  "space-station": [
    { text: "sci-fi ambient electronic, cold synths, deep space atmosphere, metallic hum, Alien film style, eerie", weight: 1.0 },
  ],
  "small-town": [
    { text: "eerie small town ambient, unsettling quiet, distant piano, Twin Peaks style, suburban dread, sparse", weight: 1.0 },
  ],
};

const SCREEN_PROMPTS: Record<Screen, WeightedPrompt[] | null> = {
  landing: [
    { text: "Eerie noir jazz, haunting piano melody, distant rain, atmospheric, mysterious, slow, moody", weight: 1.0 },
  ],
  quiz: [
    { text: "Minimal ambient noir, sparse piano, interrogation room atmosphere, slow tension, subtle dread", weight: 1.0 },
  ],
  // loading/casefile use setting-specific prompts — handled at runtime
  loading: null,
  casefile: null,
  investigation: [
    { text: "Dark tension music, slow pulsing bass, ominous atmosphere, building suspense, Victorian mystery, tense", weight: 1.0 },
  ],
  accusation: [
    { text: "Dramatic single sustained bass note, heavy tension, sparse noir, minimal, foreboding, decisive moment", weight: 1.0 },
  ],
  reveal: [
    // resolved at runtime based on isCorrect
    { text: "Dark resolution, noir ending, cinematic close, minimal", weight: 1.0 },
  ],
};

const CORRECT_REVEAL_PROMPTS: WeightedPrompt[] = [
  { text: "Triumphant jazz resolution, brass fanfare, victory theme, uplifting noir, case closed, celebratory", weight: 1.0 },
];

const WRONG_REVEAL_PROMPTS: WeightedPrompt[] = [
  { text: "Dissonant minor crash, eerie silence, dark failure, haunting regret, unsettling noir, bleak", weight: 1.0 },
];

export default function MusicManager() {
  const screen = useGameStore((s) => s.screen);
  const quizAnswers = useGameStore((s) => s.quizAnswers);
  const isCorrect = useGameStore((s) => s.isCorrect);

  const clientRef = useRef<LyriaClient | null>(null);
  const apiKeyRef = useRef<string | null>(null);
  const connectedRef = useRef(false);
  const currentScreenRef = useRef<Screen | null>(null);

  const getPrompts = useCallback(
    (s: Screen): WeightedPrompt[] => {
      if ((s === "loading" || s === "casefile") && quizAnswers?.setting) {
        return SETTING_PROMPTS[quizAnswers.setting];
      }
      if (s === "reveal") {
        return isCorrect ? CORRECT_REVEAL_PROMPTS : WRONG_REVEAL_PROMPTS;
      }
      return SCREEN_PROMPTS[s] ?? SCREEN_PROMPTS.landing!;
    },
    [quizAnswers?.setting, isCorrect]
  );

  const initMusic = useCallback(
    async (s: Screen) => {
      if (!apiKeyRef.current) {
        try {
          const res = await fetch("/api/live-token");
          const data = await res.json();
          apiKeyRef.current = data.apiKey;
        } catch {
          return;
        }
      }

      if (!apiKeyRef.current) return;

      const prompts = getPrompts(s);

      // Always tear down the previous session so buffered chunks cannot stack
      // when prompts or screens change (updatePrompts alone keeps old audio playing).
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      connectedRef.current = false;

      const client = new LyriaClient({
        onConnectionChange: (connected) => {
          connectedRef.current = connected;
        },
        onError: () => {
          connectedRef.current = false;
        },
      });

      clientRef.current = client;
      await client.connect(apiKeyRef.current, prompts);
    },
    [getPrompts]
  );

  // Connect on first user interaction (required by browser autoplay policy)
  useEffect(() => {
    let started = false;

    const handleInteraction = () => {
      if (started) return;
      started = true;
      const currentScreen = useGameStore.getState().screen;
      currentScreenRef.current = currentScreen;
      void initMusic(currentScreen);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [initMusic]);

  // Switch music when screen changes — full reconnect every time (no stacked streams)
  useEffect(() => {
    if (currentScreenRef.current === null) return;
    if (screen === currentScreenRef.current) return;

    currentScreenRef.current = screen;
    void initMusic(screen);
  }, [screen, initMusic]);

  // Adjust volume: quieter during interrogation so voice is clear
  useEffect(() => {
    if (!clientRef.current) return;
    const volume = screen === "investigation" ? 0.2 : 0.4;
    clientRef.current.setVolume(volume);
  }, [screen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  return null;
}
