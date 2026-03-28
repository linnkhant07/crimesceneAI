import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildInterrogationSystemPrompt } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const {
      suspectData,
      setting,
      crimeContext,
      chatHistory,
      userMessage,
      detectiveName,
      personalDetail,
      personalizedDetail,
    } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = buildInterrogationSystemPrompt(
      suspectData.name,
      suspectData,
      setting,
      crimeContext,
      {
        name: typeof detectiveName === "string" && detectiveName.trim() ? detectiveName.trim() : "Detective",
        personalDetail: typeof personalDetail === "string" ? personalDetail : "",
        casePersonalization: typeof personalizedDetail === "string" ? personalizedDetail : "",
      }
    );

    const conversationHistory = (chatHistory || []).map(
      (msg: { role: string; content: string }) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })
    );

    conversationHistory.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: conversationHistory,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.85,
        topP: 0.9,
        maxOutputTokens: 512,
      },
    });

    const text = response.text ?? "";

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error("Interrogation error:", error);
    return NextResponse.json(
      { error: "Failed to get suspect response" },
      { status: 500 }
    );
  }
}
