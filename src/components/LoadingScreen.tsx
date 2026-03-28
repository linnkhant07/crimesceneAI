"use client";

import { useEffect, useState, useRef } from "react";
import { useGameStore } from "@/store/gameStore";

const STEPS = [
  "Identifying victim...",
  "Planting evidence...",
  "Briefing suspects...",
  "Hiding the truth...",
  "Your case is ready.",
];

export default function LoadingScreen() {
  const { quizAnswers, setCrimeCase, setScreen } = useGameStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepComplete, setStepComplete] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [glitchActive, setGlitchActive] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || !quizAnswers) return;
    fetchedRef.current = true;

    async function generate() {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quizAnswers),
        });

        if (!res.ok) throw new Error("Failed to generate case");
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setCrimeCase(data);

        for (let i = 0; i < STEPS.length; i++) {
          await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
          setCurrentStep(i);
          setStepComplete((prev) => [...prev, true]);
        }

        await new Promise((r) => setTimeout(r, 1000));
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
  }, [quizAnswers, setCrimeCase, setScreen]);

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center overflow-hidden">
      {glitchActive && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="glitch-lines" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-lg px-8">
        <h2 className="text-xl font-mono text-red-500 tracking-[0.3em] mb-12 text-center">
          CASE FILE GENERATING...
        </h2>

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
                style={{
                  animation:
                    i === currentStep && !stepComplete[i]
                      ? "typewriter 0.5s steps(20)"
                      : undefined,
                }}
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
