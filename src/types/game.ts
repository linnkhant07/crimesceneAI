export type Setting = "noir-city" | "medieval-castle" | "space-station" | "small-town";

export interface QuizAnswers {
  setting: Setting;
  detectiveName: string;
  personalDetail: string;
  suspectCount: 2 | 3;
}

export interface Suspect {
  name: string;
  age: number;
  occupation: string;
  relationship: string;
  appearance: string;
  personality: string;
  alibi: string;
  isGuilty: boolean;
  secretMotive: string;
  gender: "male" | "female";
  portraitUrl?: string;
}

export interface CrimeCase {
  caseNumber: string;
  victim: {
    name: string;
    age: number;
    occupation: string;
  };
  location: string;
  timeOfDeath: string;
  causeOfDeath: string;
  crimeSceneDescription: string;
  clues: {
    text: string;
    type: "obvious" | "misleading" | "key";
  }[];
  suspects: Suspect[];
  trueStory: string;
  personalizedDetail: string;
  keyClueCallback: string;
}

export interface ChatMessage {
  role: "user" | "suspect";
  content: string;
  timestamp: number;
}

export interface CrimeSceneImage {
  url: string;
  description: string;
}

export interface TaggedClue {
  id: number;
  imageIndex: number;
  x: number; // percentage 0–100
  y: number; // percentage 0–100
}

export type Screen =
  | "landing"
  | "quiz"
  | "loading"
  | "casefile"
  | "investigation"
  | "accusation"
  | "reveal";

export interface InterrogationState {
  currentSuspectIndex: number;
  chatHistories: Record<number, ChatMessage[]>;
  notes: string;
  questionsAsked: number;
  startTime: number;
}
