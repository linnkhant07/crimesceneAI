import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const uri = req.nextUrl.searchParams.get("uri");
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

    const buffer = await response.arrayBuffer();

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
