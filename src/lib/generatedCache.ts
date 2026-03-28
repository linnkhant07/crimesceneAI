import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CASES_DIR = path.join(ROOT, "generated", "cases");
const PORTRAITS_DIR = path.join(ROOT, "public", "generated", "portraits");

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

// ─── Crime Scene Images ────────────────────────────────────────────────────────

const CRIME_SCENES_DIR = path.join(ROOT, "public", "generated", "crime-scenes");

function crimeSceneKey(setting: string, location: string): string {
  return slug(`${setting}-${location}`);
}

export function getCachedCrimeSceneUrls(
  setting: string,
  location: string
): string[] | null {
  const key = crimeSceneKey(setting, location);
  const urls: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const file = path.join(CRIME_SCENES_DIR, `${key}-${i}.png`);
    if (!fs.existsSync(file)) return null;
    urls.push(`/generated/crime-scenes/${key}-${i}.png`);
  }
  return urls;
}

export function saveCrimeSceneToCache(
  setting: string,
  location: string,
  index: number,
  base64Data: string
): string {
  fs.mkdirSync(CRIME_SCENES_DIR, { recursive: true });
  const key = crimeSceneKey(setting, location);
  const file = path.join(CRIME_SCENES_DIR, `${key}-${index}.png`);
  fs.writeFileSync(file, Buffer.from(base64Data, "base64"));
  return `/generated/crime-scenes/${key}-${index}.png`;
}
