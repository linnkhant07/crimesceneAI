"use client";

import { useEffect, useState, useRef } from "react";
import { useGameStore } from "@/store/gameStore";

const STEPS = [
  "Consulting the index...",
  "Cross-referencing witnesses...",
  "Walking the scene in silence...",
  "Sealing exhibits...",
  "The file is yours.",
];

export default function LoadingScreen() {
  const {
    quizAnswers,
    setCrimeCase,
    setSuspectPortrait,
    setCrimeSceneImages,
    setScreen,
  } = useGameStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepComplete, setStepComplete] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [glitchActive, setGlitchActive] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || !quizAnswers) return;
    fetchedRef.current = true;

    async function completeStep(index: number) {
      setCurrentStep(index);
      setStepComplete((prev) => {
        const next = [...prev];
        next[index] = true;
        return next;
      });
    }

    async function generate() {
      try {
        // Step 1: Generate crime case text
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quizAnswers),
        });

        if (!res.ok) throw new Error("Failed to generate case");
        const caseData = await res.json();
        if (caseData.error) throw new Error(caseData.error);

        setCrimeCase(caseData);
        await completeStep(0);

        // Step 2: Generate suspect portraits in parallel
        const portraitPromises = caseData.suspects.map(
          async (suspect: { name: string; appearance: string; occupation: string }, i: number) => {
            try {
              const portraitRes = await fetch("/api/generate-portrait", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: suspect.name,
                  appearance: suspect.appearance,
                  occupation: suspect.occupation,
                  setting: quizAnswers!.setting,
                }),
              });
              const { imageUrl } = await portraitRes.json();
              if (imageUrl) {
                setSuspectPortrait(i, imageUrl);
              }
            } catch {
              // Portrait generation failed, continue without it
            }
          }
        );

        await Promise.all(portraitPromises);
        await completeStep(1);

        // Step 3: Generate crime scene images
        try {
          const imgRes = await fetch("/api/generate-crime-scene-images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              crimeSceneDescription: caseData.crimeSceneDescription,
              setting: quizAnswers!.setting,
              location: caseData.location,
              clues: caseData.clues,
              victimName: caseData.victim.name,
            }),
          });
          const imgData = await imgRes.json();
          if (imgData.images?.length) {
            setCrimeSceneImages(imgData.images);
          }
        } catch {
          // Crime scene images failed — continue without them
        }
        await completeStep(2);

        // Step 4: Finalize
        await new Promise((r) => setTimeout(r, 500));
        await completeStep(3);

        await new Promise((r) => setTimeout(r, 400));
        await completeStep(4);

        await new Promise((r) => setTimeout(r, 800));
        setScreen("casefile");
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      }
    }

    setGlitchActive(true);
    setTimeout(() => setGlitchActive(false), 2000);
    generate();
  }, [quizAnswers, setCrimeCase, setSuspectPortrait, setCrimeSceneImages, setScreen]);

  return (
    <div className="fixed inset-0 bg-[#060608] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-amber-950/10 pointer-events-none" />
      {glitchActive && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="glitch-lines opacity-70" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-lg px-8">
        <p className="font-mono text-[10px] tracking-[0.45em] text-amber-800/90 text-center mb-3 uppercase">
          Sherlock AI
        </p>
        <h2 className="font-display text-xl md:text-2xl text-amber-100/90 tracking-[0.15em] mb-2 text-center">
          Composing your case file
        </h2>
        <p className="text-gray-600 font-mono text-xs tracking-wider text-center mb-12">
          Do not refresh — evidence is being set in order.
        </p>

        <div className="space-y-4 mb-12">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 font-mono text-sm transition-all duration-500 ${
                i <= currentStep ? "opacity-100" : "opacity-20"
              }`}
            >
              <span className="text-gray-600">▸</span>
              <span
                className={`flex-1 ${
                  stepComplete[i] ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {step}
              </span>
              <span
                className={`text-green-500 transition-opacity duration-300 ${
                  stepComplete[i] ? "opacity-100" : "opacity-0"
                }`}
              >
                ✓
              </span>
            </div>
          ))}
        </div>

        {error ? (
          <div className="text-center">
            <p className="text-red-500 font-mono text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 border border-red-800/50 text-red-500 font-mono text-sm
                         hover:bg-red-500/10 transition-all cursor-pointer"
            >
              RETRY
            </button>
          </div>
        ) : (
          <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-800 transition-all duration-700 ease-out"
              style={{
                width: `${((currentStep + 1) / STEPS.length) * 100}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
