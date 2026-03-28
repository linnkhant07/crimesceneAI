import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { storeOperation } from "@/lib/videoCache";

export async function POST(req: NextRequest) {
  try {
    const { crimeSceneDescription, setting, location } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const settingVibes: Record<string, string> = {
      "noir-city":
        "1940s noir film style, rain-slicked streets, neon signs reflecting in puddles, black and white with splashes of color, jazz undertones",
      "medieval-castle":
        "dark medieval atmosphere, flickering torchlight, stone corridors, mist and shadows, Game of Thrones style cinematography",
      "space-station":
        "sci-fi thriller atmosphere, cold metallic corridors, emergency lights, floating particles, Alien/2001 style cinematography",
      "small-town":
        "eerie small town atmosphere, foggy streets, porch lights, unsettling calm, Twin Peaks style cinematography",
    };

    const vibe = settingVibes[setting] || "dark thriller atmosphere";

    const prompt = `A slow, cinematic crime scene walkthrough video. ${vibe}.

Scene: ${crimeSceneDescription}
Location: ${location}

Camera slowly pans across the scene, revealing details. Dramatic, moody lighting. No people visible, only the aftermath. The atmosphere is tense and foreboding. Professional cinematography with shallow depth of field. Eerie ambient sounds.`;

    const ai = new GoogleGenAI({ apiKey });

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt,
      config: {
        aspectRatio: "16:9",
      },
    });

    const operationId = crypto.randomUUID();
    storeOperation(operationId, operation);

    return NextResponse.json({
      operationId,
      done: false,
    });
  } catch (error) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      { error: "Failed to start video generation" },
      { status: 500 }
    );
  }
}
