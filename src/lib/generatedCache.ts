import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CASES_DIR = path.join(ROOT, "generated", "cases");
const PORTRAITS_DIR = path.join(ROOT, "public", "generated", "portraits");
const VIDEOS_DIR = path.join(ROOT, "public", "generated", "videos");

function slug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ─── Cases ────────────────────────────────────────────────────────────────────

function caseKey(setting: string, detectiveName: string, suspectCount: number): string {
  return slug(`${setting}-${detectiveName}-${suspectCount}`);
}

export function getCachedCase(
  setting: string,
  detectiveName: string,
  suspectCount: number
): object | null {
  const file = path.join(CASES_DIR, `${caseKey(setting, detectiveName, suspectCount)}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

export function saveCaseToCache(
  setting: string,
  detectiveName: string,
  suspectCount: number,
  data: object
): void {
  fs.mkdirSync(CASES_DIR, { recursive: true });
  const file = path.join(CASES_DIR, `${caseKey(setting, detectiveName, suspectCount)}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Portraits ────────────────────────────────────────────────────────────────

function portraitKey(name: string, occupation: string, setting: string): string {
  return slug(`${name}-${occupation}-${setting}`);
}

export function getCachedPortraitUrl(
  name: string,
  occupation: string,
  setting: string
): string | null {
  const key = portraitKey(name, occupation, setting);
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const file = path.join(PORTRAITS_DIR, `${key}.${ext}`);
    if (fs.existsSync(file)) return `/generated/portraits/${key}.${ext}`;
  }
  return null;
}

export function savePortraitToCache(
  name: string,
  occupation: string,
  setting: string,
  base64Data: string,
  mimeType: string
): string {
  fs.mkdirSync(PORTRAITS_DIR, { recursive: true });
  const ext = mimeType.split("/")[1]?.split(";")[0] || "png";
  const key = portraitKey(name, occupation, setting);
  const file = path.join(PORTRAITS_DIR, `${key}.${ext}`);
  fs.writeFileSync(file, Buffer.from(base64Data, "base64"));
  return `/generated/portraits/${key}.${ext}`;
}

// ─── Videos ───────────────────────────────────────────────────────────────────

function videoKey(setting: string, location: string): string {
  return slug(`${setting}-${location}`);
}

export function getCachedVideoUrl(setting: string, location: string): string | null {
  const key = videoKey(setting, location);
  const file = path.join(VIDEOS_DIR, `${key}.mp4`);
  if (fs.existsSync(file)) return `/generated/videos/${key}.mp4`;
  return null;
}

export function saveVideoToCache(
  setting: string,
  location: string,
  buffer: Buffer
): string {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  const key = videoKey(setting, location);
  const file = path.join(VIDEOS_DIR, `${key}.mp4`);
  fs.writeFileSync(file, buffer);
  return `/generated/videos/${key}.mp4`;
}
