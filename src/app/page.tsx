"use client";

import { useGameStore } from "@/store/gameStore";
import LandingScreen from "@/components/LandingScreen";
import QuizScreen from "@/components/QuizScreen";
import LoadingScreen from "@/components/LoadingScreen";
import CaseFileScreen from "@/components/CaseFileScreen";
import InvestigationScreen from "@/components/InvestigationScreen";
import AccusationScreen from "@/components/AccusationScreen";
import RevealScreen from "@/components/RevealScreen";
import MusicManager from "@/components/MusicManager";

const SCREENS = {
  landing: LandingScreen,
  quiz: QuizScreen,
  loading: LoadingScreen,
  casefile: CaseFileScreen,
  investigation: InvestigationScreen,
  accusation: AccusationScreen,
  reveal: RevealScreen,
} as const;

export default function Home() {
  const screen = useGameStore((s) => s.screen);
  const ScreenComponent = SCREENS[screen];

  return (
    <>
      <MusicManager />
      <ScreenComponent />
    </>
  );
}
