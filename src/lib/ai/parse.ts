import { DEFAULT_PALETTE, type Palette, type ProjectKind } from "@/lib/projects/types";
import { assembleHtml, ensureScreenFiles, parseProjectFiles, seedFiveScreens, type ProjectFile } from "@/lib/projects/files";
import { fenix2Files } from "@/lib/projects/fenix2";

export type BuildResult = {
  name: string;
  tagline: string;
  kind: ProjectKind;
  summary: string;
  direction: string;
  palette: Palette;
  html: string;
  files: ProjectFile[];
};

const KINDS: ProjectKind[] = ["landing", "app", "dashboard", "tool", "game", "site"];

function asKind(value: unknown): ProjectKind {
  return typeof value === "string" && KINDS.includes(value as ProjectKind)
    ? (value as ProjectKind)
    : "app";
}

function asHex(value: unknown, fallback: string) {
  if (typeof value === "string" && /^#([0-9a-fA-F]{6})$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function asText(value: unknown, fallback: string, max = 80) {
  if (typeof value !== "string") return fallback;
  const t = value
    .replace(/\b(iOS|Apple|Grok|Fenix|xAI|Emergent|Kreluna)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return fallback;
  return t.slice(0, max);
}

function parseMeta(raw: string): Omit<BuildResult, "html" | "files"> {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const paletteIn =
      data.palette && typeof data.palette === "object"
        ? (data.palette as Record<string, unknown>)
        : {};
    return {
      name: asText(data.name, "Studio"),
      tagline: asText(data.tagline, "", 120),
      kind: asKind(data.kind),
      summary: asText(data.summary, "", 280),
      direction: asText(data.direction, "", 80),
      palette: {
        bg: asHex(paletteIn.bg, DEFAULT_PALETTE.bg),
        surface: asHex(paletteIn.surface, DEFAULT_PALETTE.surface),
        fg: asHex(paletteIn.fg, DEFAULT_PALETTE.fg),
        muted: asHex(paletteIn.muted, DEFAULT_PALETTE.muted),
        accent: asHex(paletteIn.accent, DEFAULT_PALETTE.accent),
      },
    };
  } catch {
    return {
      name: "Studio",
      tagline: "",
      kind: "site",
      summary: "",
      direction: "",
      palette: DEFAULT_PALETTE,
    };
  }
}

function extractHtml(text: string) {
  const doctype = text.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
  if (doctype) return doctype[0];
  const html = text.match(/<html[\s\S]*<\/html>/i);
  if (html) return `<!DOCTYPE html>\n${html[0]}`;
  return "";
}

export function parseBuildOutput(text: string): BuildResult | null {
  const trimmed = text.trim();
  const metaBlock = trimmed.match(/<<<META>>>\s*([\s\S]*?)(?:<<<HTML>>>|<<<FILE |$)/);
  const htmlBlock = trimmed.match(/<<<HTML>>>\s*([\s\S]*?)(?:<<<FILE |<<<END>>>|$)/);
  let files = parseProjectFiles(trimmed);

  let html = "";
  if (htmlBlock) html = extractHtml(htmlBlock[1] ?? "") || htmlBlock[1]?.trim() || "";
  if (!html) html = assembleHtml(files) || extractHtml(trimmed);

  if (!html || html.length < 80) return null;
  if (!/<\/html>/i.test(html)) html = `${html}\n</body>\n</html>`;

  if (!files.some((f) => /(^|\/)index\.html$/i.test(f.path))) {
    files = [{ path: "index.html", content: html }, ...files];
  }
  files = ensureScreenFiles(files, html);
  files = seedFiveScreens(files, html, metaBlock ? undefined : "App");
  html = assembleHtml(files, html) || html;

  const meta = parseMeta(metaBlock?.[1]?.trim() || "{}");
  files = seedFiveScreens(files, html, meta.name);
  html = assembleHtml(files, html) || html;
  files = fenix2Files(files, { name: meta.name, palette: meta.palette });
  if (meta.name === "Studio") {
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    if (title) meta.name = title.slice(0, 80);
  }
  return { ...meta, html, files };
}
