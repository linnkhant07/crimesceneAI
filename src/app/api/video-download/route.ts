import { NextRequest, NextResponse } from "next/server";
import { saveVideoToCache } from "@/lib/generatedCache";

export async function GET(req: NextRequest) {
  try {
    const uri = req.nextUrl.searchParams.get("uri");
    const setting = req.nextUrl.searchParams.get("setting") ?? "unknown";
    const location = req.nextUrl.searchParams.get("location") ?? "scene";
    const apiKey = process.env.GEMINI_API_KEY;

    if (!uri || !apiKey) {
      return NextResponse.json(
        { error: "Missing video URI or API key" },
        { status: 400 }
      );
    }

    const separator = uri.includes("?") ? "&" : "?";
    const response = await fetch(`${uri}${separator}key=${apiKey}`, {
      headers: {
        "x-goog-api-key": apiKey,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download video: ${response.status}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save video to disk for reuse
    const savedUrl = saveVideoToCache(setting, location, buffer);
    console.log("💾  Saved video →", savedUrl);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "video/mp4",
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Video download error:", error);
    return NextResponse.json(
      { error: "Failed to download video" },
      { status: 500 }
    );
  }
}
