"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";

function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export default function LandingScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [flickerOn, setFlickerOn] = useState(true);

  const cityLights = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        left: `${3 + i * 3.2}%`,
        width: `${2 + seededRandom(i * 7 + 1) * 3}px`,
        height: `${2 + seededRandom(i * 7 + 2) * 3}px`,
        backgroundColor: `hsl(${30 + seededRandom(i * 7 + 3) * 30}, 80%, ${50 + seededRandom(i * 7 + 4) * 20}%)`,
        opacity: 0.3 + seededRandom(i * 7 + 5) * 0.4,
        filter: `blur(${1 + seededRandom(i * 7 + 6) * 2}px)`,
        animation: `pulse ${2 + seededRandom(i * 7 + 7) * 3}s ease-in-out infinite`,
        animationDelay: `${seededRandom(i * 7 + 8) * 2}s`,
      })),
    []
  );

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.3) {
        setFlickerOn(false);
        setTimeout(() => setFlickerOn(true), 50 + Math.random() * 100);
      }
    }, 2000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const drops: { x: number; y: number; speed: number; length: number }[] = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 200; i++) {
      drops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: 4 + Math.random() * 8,
        length: 10 + Math.random() * 20,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.strokeStyle = "rgba(174, 194, 224, 0.15)";
      ctx!.lineWidth = 1;

      for (const drop of drops) {
        ctx!.beginPath();
        ctx!.moveTo(drop.x, drop.y);
        ctx!.lineTo(drop.x + 0.5, drop.y + drop.length);
        ctx!.stroke();

        drop.y += drop.speed;
        if (drop.y > canvas!.height) {
          drop.y = -drop.length;
          drop.x = Math.random() * canvas!.width;
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#060608] overflow-hidden flex items-center justify-center">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none opacity-90" />

      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/10 via-transparent to-black/80" />
      <div className="absolute inset-0 bg-gradient-radial from-amber-900/5 via-transparent to-[#060608]" />

      <div className="absolute bottom-0 left-0 right-0 h-32">
        {cityLights.map((style, i) => (
          <div key={i} className="absolute bottom-4 rounded-full" style={style} />
        ))}
      </div>

      <div
        className={`relative z-10 text-center max-w-3xl px-6 transition-all duration-[2000ms] ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <p className="font-mono text-[10px] md:text-xs tracking-[0.5em] text-amber-700/80 mb-6 uppercase">
          221B · Confidential
        </p>

        <h1
          className="font-display text-5xl md:text-7xl lg:text-8xl font-semibold tracking-[0.12em] text-white mb-4 transition-opacity duration-100"
          style={{ opacity: flickerOn ? 1 : 0.15 }}
        >
          <span className="text-amber-100">SHERLOCK</span>
          <span className="text-gray-600 mx-1 md:mx-2 font-light">·</span>
          <span className="text-red-600">AI</span>
        </h1>

        <p className="font-mono text-xs md:text-sm tracking-[0.35em] text-gray-500 uppercase mb-4">
          The game is afoot
        </p>

        <p className="text-gray-600 text-base md:text-lg font-light italic tracking-wide mb-14 border-t border-amber-900/20 pt-8 mx-auto max-w-md">
          Step into the fog. Every deduction is personal.
        </p>

        <button
          onClick={() => setScreen("quiz")}
          className="group relative px-12 py-4 border border-amber-900/40 text-amber-200/90 font-mono text-sm tracking-[0.25em] uppercase
                     hover:bg-amber-950/40 hover:border-red-700/50 hover:text-red-400 transition-all duration-500 cursor-pointer
                     before:absolute before:inset-0 before:bg-red-950/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity"
        >
          <span className="relative z-10">Open your dossier</span>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-red-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-red-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-red-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-red-500" />
          </div>
        </button>
      </div>
    </div>
  );
}
