import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildCrimeGenerationPrompt } from "@/lib/prompts";
import { getCachedCase, saveCaseToCache } from "@/lib/generatedCache";
import type { QuizAnswers } from "@/types/game";

export async function POST(req: NextRequest) {
  try {
    const answers: QuizAnswers = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    //ghost comment

    // Return cached case if one exists for this setting + detective
    const cached = getCachedCase(answers.setting, answers.detectiveName, answers.suspectCount);
    if (cached) {
      console.log("🗂️  Serving cached case for", answers.detectiveName);
      return NextResponse.json(cached);
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildCrimeGenerationPrompt(answers);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.65,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    });

    const text = response.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse crime case from AI response" },
        { status: 500 }
      );
    }

    const crimeCase = JSON.parse(jsonMatch[0]);

    // Save to cache
    saveCaseToCache(answers.setting, answers.detectiveName, answers.suspectCount, crimeCase);
    console.log("💾  Saved case to cache for", answers.detectiveName);

    return NextResponse.json(crimeCase);
  } catch (error) {
    console.error("Crime generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate crime case" },
      { status: 500 }
    );
  }
}
