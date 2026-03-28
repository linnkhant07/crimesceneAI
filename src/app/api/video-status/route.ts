import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getOperation, storeOperation, removeOperation } from "@/lib/videoCache";

export async function GET(req: NextRequest) {
  try {
    const operationId = req.nextUrl.searchParams.get("id");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || !operationId) {
      return NextResponse.json(
        { error: "Missing API key or operation ID" },
        { status: 400 }
      );
    }

    const cachedOperation = getOperation(operationId);
    if (!cachedOperation) {
      return NextResponse.json(
        { error: "Operation not found. It may have expired." },
        { status: 404 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const updated = await ai.operations.getVideosOperation({
      operation: cachedOperation,
    });

    if (updated.done) {
      const video = updated.response?.generatedVideos?.[0]?.video;
      removeOperation(operationId);

      if (video?.uri) {
        return NextResponse.json({
          done: true,
          videoUri: video.uri,
        });
      }
      return NextResponse.json({
        done: true,
        error: "Video generated but no URI available",
      });
    }

    storeOperation(operationId, updated);
    return NextResponse.json({ done: false });
  } catch (error) {
    console.error("Video status check error:", error);
    return NextResponse.json(
      { error: "Failed to check video status" },
      { status: 500 }
    );
  }
}
