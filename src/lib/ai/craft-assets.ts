import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { BANNED_CRAFT_SHA256 } from "./craft-media.ts";

export {
  BANNED_CRAFT_SHA256,
  CRAFT_GALLERY_FILES,
  CRAFT_HERO_FILE,
  CRAFT_PHOTO_FILES,
} from "./craft-media.ts";


export type CraftPhotoReport = {
  file: string;
  ok: boolean;
  width: number;
  height: number;
  ratio: number;
  sha256: string;
  notes: string[];
};

function jpegSize(buf: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xc2) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function sampleRgb(filePath: string): Buffer | null {
  const proc = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", filePath, "-vf", "scale=48:48", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
    { encoding: "buffer", maxBuffer: 20_000 },
  );
  if (proc.status !== 0 || !proc.stdout || proc.stdout.length < 48 * 48 * 3) return null;
  return proc.stdout.subarray(0, 48 * 48 * 3);
}

/** Phone-UI screenshot: dark navy chrome + violet type, not clay. */
export function looksLikeUiScreenshot(rgb: Buffer): boolean {
  const n = Math.floor(rgb.length / 3);
  if (n < 16) return true;
  let navy = 0;
  let violet = 0;
  let warmClay = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    if (r < 40 && g < 35 && b < 70 && b >= g) navy += 1;
    if (b > r + 18 && b > 90 && r > 50 && r < 190 && g > 40 && g < 180) violet += 1;
    if (r > g + 8 && r > 70 && g > 35 && b < g + 10) warmClay += 1;
  }
  if (navy / n > 0.14) return true;
  if (violet / n > 0.08) return true;
  if (warmClay / n < 0.12 && navy / n > 0.06) return true;
  return false;
}

export function auditCraftPhoto(filePath: string, file = filePath.split("/").pop() || filePath): CraftPhotoReport {
  const notes: string[] = [];
  const buf = readFileSync(filePath);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  if (BANNED_CRAFT_SHA256.includes(sha256)) notes.push("hash of the Fenix phone screenshot");
  if (buf[0] !== 0xff || buf[1] !== 0xd8) notes.push("not a JPEG");
  const size = jpegSize(buf);
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const ratio = height ? width / height : 0;
  if (width < 1100) notes.push(`width ${width} < 1100`);
  if (ratio < 1.4 || ratio > 2.2) notes.push(`aspect ${ratio.toFixed(3)} not landscape 1.4–2.2`);
  const rgb = sampleRgb(filePath);
  if (rgb) {
    if (looksLikeUiScreenshot(rgb)) notes.push("pixels look like UI chrome, not clay");
  } else if (process.env.FENIX_REQUIRE_PIXEL_GATE === "1") {
    notes.push("could not sample pixels");
  }
  return { file, ok: notes.length === 0, width, height, ratio, sha256, notes };
}
