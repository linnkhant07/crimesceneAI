"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
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
    <div className="fixed inset-0 bg-[#0a0a0f] overflow-hidden flex items-center justify-center">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-[#0a0a0f]" />

      <div className="absolute bottom-0 left-0 right-0 h-32">
        {cityLights.map((style, i) => (
          <div key={i} className="absolute bottom-4 rounded-full" style={style} />
        ))}
      </div>

      <div
        className={`relative z-10 text-center transition-all duration-[2000ms] ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <h1
          className="text-5xl md:text-7xl font-mono tracking-[0.4em] text-white mb-6 transition-opacity duration-100"
          style={{ opacity: flickerOn ? 1 : 0.1 }}
        >
          <span className="text-red-500">C R I M E</span>
          <span className="text-gray-500">SCENE</span>
          <span className="text-white">.AI</span>
        </h1>

        <p className="text-gray-500 text-lg md:text-xl font-light italic tracking-wider mb-16">
          &ldquo;Every crime is personal.&rdquo;
        </p>

        <button
          onClick={() => setScreen("quiz")}
          className="group relative px-12 py-4 border border-red-800/50 text-red-500 font-mono text-sm tracking-[0.3em] uppercase
                     hover:bg-red-500/10 hover:border-red-500/80 transition-all duration-500 cursor-pointer
                     before:absolute before:inset-0 before:bg-red-500/5 before:animate-pulse"
        >
          <span className="relative z-10">BEGIN INVESTIGATION</span>
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
