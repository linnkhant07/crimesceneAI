"use client";

import { create } from "zustand";
import type {
  Screen,
  QuizAnswers,
  CrimeCase,
  ChatMessage,
  InterrogationState,
} from "@/types/game";

interface GameState {
  screen: Screen;
  quizAnswers: QuizAnswers | null;
  crimeCase: CrimeCase | null;
  interrogation: InterrogationState;
  accusedSuspectIndex: number | null;
  isCorrect: boolean | null;
  startTime: number | null;

  setScreen: (screen: Screen) => void;
  setQuizAnswers: (answers: QuizAnswers) => void;
  setCrimeCase: (crimeCase: CrimeCase) => void;
  switchSuspect: (index: number) => void;
  addMessage: (suspectIndex: number, message: ChatMessage) => void;
  updateNotes: (notes: string) => void;
  incrementQuestions: () => void;
  makeAccusation: (suspectIndex: number) => void;
  reset: () => void;
}

const initialInterrogation: InterrogationState = {
  currentSuspectIndex: 0,
  chatHistories: {},
  notes: "",
  questionsAsked: 0,
  startTime: 0,
};

export const useGameStore = create<GameState>((set) => ({
  screen: "landing",
  quizAnswers: null,
  crimeCase: null,
  interrogation: { ...initialInterrogation },
  accusedSuspectIndex: null,
  isCorrect: null,
  startTime: null,

  setScreen: (screen) => set({ screen }),
  setQuizAnswers: (answers) => set({ quizAnswers: answers }),
  setCrimeCase: (crimeCase) =>
    set({
      crimeCase,
      interrogation: {
        ...initialInterrogation,
        startTime: Date.now(),
        chatHistories: Object.fromEntries(
          crimeCase.suspects.map((_, i) => [i, []])
        ),
      },
    }),

  switchSuspect: (index) =>
    set((state) => ({
      interrogation: { ...state.interrogation, currentSuspectIndex: index },
    })),

  addMessage: (suspectIndex, message) =>
    set((state) => ({
      interrogation: {
        ...state.interrogation,
        chatHistories: {
          ...state.interrogation.chatHistories,
          [suspectIndex]: [
            ...(state.interrogation.chatHistories[suspectIndex] || []),
            message,
          ],
        },
      },
    })),

  updateNotes: (notes) =>
    set((state) => ({
      interrogation: { ...state.interrogation, notes },
    })),

  incrementQuestions: () =>
    set((state) => ({
      interrogation: {
        ...state.interrogation,
        questionsAsked: state.interrogation.questionsAsked + 1,
      },
    })),

  makeAccusation: (suspectIndex) =>
    set((state) => {
      const suspect = state.crimeCase?.suspects[suspectIndex];
      return {
        accusedSuspectIndex: suspectIndex,
        isCorrect: suspect?.isGuilty ?? false,
        screen: "reveal" as Screen,
      };
    }),

  reset: () =>
    set({
      screen: "landing",
      quizAnswers: null,
      crimeCase: null,
      interrogation: { ...initialInterrogation },
      accusedSuspectIndex: null,
      isCorrect: null,
      startTime: null,
    }),
}));
