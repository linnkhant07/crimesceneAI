import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getCachedPortraitUrl, savePortraitToCache } from "@/lib/generatedCache";

export async function POST(req: NextRequest) {
  try {
    const { name, appearance, occupation, setting } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const settingStyles: Record<string, string> = {
      "noir-city":
        "1940s noir style, black and white with dramatic shadows, rain-streaked window light, smoke-filled room",
      "medieval-castle":
        "medieval oil painting style, candlelit, stone walls in background, dramatic chiaroscuro lighting",
      "space-station":
        "sci-fi style, cold blue-white lighting, metallic reflections, futuristic setting",
      "small-town":
        "small town Americana style, warm but unsettling lighting, suburban setting, slightly eerie",
    };

    const style = settingStyles[setting] || "dramatic noir lighting";

    // Return cached portrait if available
    const cachedUrl = getCachedPortraitUrl(name, occupation, setting);
    if (cachedUrl) {
      console.log("🗂️  Serving cached portrait for", name);
      return NextResponse.json({ imageUrl: cachedUrl });
    }

    const prompt = `Generate a dramatic portrait photograph of a crime suspect for a detective game.

Character: ${name}, a ${occupation}.
Appearance: ${appearance}
Style: ${style}

Requirements:
- Head and shoulders portrait, facing slightly to the side
- Moody, dramatic lighting like a police interrogation room
- Dark background
- The person should look slightly suspicious or uneasy
- Photorealistic style
- No text or watermarks in the image`;

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      return NextResponse.json({ imageData: null });
    }

    for (const part of parts) {
      if (part.inlineData?.data && part.inlineData?.mimeType) {
        // Save to disk and return a URL instead of raw base64
        const imageUrl = savePortraitToCache(name, occupation, setting, part.inlineData.data, part.inlineData.mimeType);
        console.log("💾  Saved portrait for", name, "→", imageUrl);
        return NextResponse.json({ imageUrl });
      }
    }

    return NextResponse.json({ imageUrl: null });
  } catch (error) {
    console.error("Portrait generation error:", error);
    return NextResponse.json({ imageUrl: null });
  }
}
