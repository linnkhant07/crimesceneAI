import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getCachedCrimeSceneUrls, saveCrimeSceneToCache } from "@/lib/generatedCache";

const SETTING_STYLES: Record<string, string> = {
  "noir-city": "1940s noir film photograph, black and white, high contrast, dramatic shadows, rain-slicked surfaces, cigarette smoke, grainy film texture",
  "medieval-castle": "dark medieval oil painting, candlelit, stone and shadow, Renaissance chiaroscuro, muted earthy tones, flickering torch light",
  "space-station": "cold clinical sci-fi photography, harsh fluorescent lighting, metallic surfaces, desaturated blue-white palette, sharp sterile shadows",
  "small-town": "muted realistic photography, overcast flat light, suburban Americana, slightly washed-out colours, quiet unsettling stillness",
};

export async function POST(req: NextRequest) {
  try {
    const { crimeSceneDescription, setting, location, clues, victimName } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    // Return cached images if all 3 exist
    const cached = getCachedCrimeSceneUrls(setting, location);
    if (cached) {
      console.log("🗂️  Serving cached crime scene images for", location);
      return NextResponse.json({ images: cached.map((url) => ({ url, description: "" })) });
    }

    const style = SETTING_STYLES[setting] || "dark thriller photography, dramatic lighting";
    const clueTexts = clues.slice(0, 2).map((c: { text: string }) => c.text);

    const ai = new GoogleGenAI({ apiKey });

    // Step 1 — Ask Gemini to write 3 detailed image prompts
    const promptGenResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a visual director for a noir murder mystery game. Generate 3 image generation prompts for crime scene photos.

Crime scene: ${crimeSceneDescription}
Location: ${location}
Victim: ${victimName}
Visual style: ${style}
Clue 1 to embed visually: "${clueTexts[0] ?? ""}"
Clue 2 to embed visually: "${clueTexts[1] ?? ""}"

Generate:
1. A wide establishing shot of the full crime scene — atmospheric, no people present
2. A close-up detail shot where clue 1 is visible in the scene but unlabelled
3. A close-up detail shot where clue 2 is visible in the scene but unlabelled

Return ONLY a JSON object in this exact format:
{
  "images": [
    { "description": "one sentence describing what this shot shows", "prompt": "detailed image generation prompt under 200 words" },
    { "description": "...", "prompt": "..." },
    { "description": "...", "prompt": "..." }
  ]
}

Rules: no text overlays, no labels, no arrows in any image. Style must match: ${style}.`,
      config: { temperature: 0.8, maxOutputTokens: 2048 },
    });

    const raw = promptGenResponse.text ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to generate image prompts" }, { status: 500 });
    }
    const { images: imagePlans } = JSON.parse(jsonMatch[0]) as {
      images: { description: string; prompt: string }[];
    };

    // Step 2 — Generate all 3 images in parallel
    const imageResults = await Promise.all(
      imagePlans.map(async (plan, i) => {
        try {
          const res = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: `${plan.prompt}\n\nStyle: ${style}. No people. No text. No labels.`,
            config: { responseModalities: ["IMAGE"] },
          });
          const parts = res.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")) {
              const url = saveCrimeSceneToCache(setting, location, i + 1, part.inlineData.data);
              console.log(`💾  Saved crime scene image ${i + 1} →`, url);
              return { url, description: plan.description };
            }
          }
          return null;
        } catch (err) {
          console.error(`Crime scene image ${i + 1} generation error:`, err);
          return null;
        }
      })
    );

    const validImages = imageResults.filter(Boolean) as { url: string; description: string }[];
    return NextResponse.json({ images: validImages });
  } catch (error) {
    console.error("Crime scene image generation error:", error);
    return NextResponse.json({ error: "Failed to generate crime scene images" }, { status: 500 });
  }
}
