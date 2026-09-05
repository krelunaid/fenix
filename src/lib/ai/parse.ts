import { assembleHtml, dropPhoneScreenFiles, ensureScreenFiles, ingestProjectFiles, parseProjectFiles, seedFiveScreens, type ProjectFile } from "../projects/files.ts";
import { type Palette, type ProjectKind } from "../projects/types.ts";
import { fallbackPaletteFromBrief } from "../projects/design-tokens.ts";
import { enforceGraphicIntent } from "../projects/graphic-intent.ts";
import { isPhoneKind } from "../projects/infer.ts";
import { fenix2Files } from "../projects/fenix2.ts";

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

type RetainedMetadata = Partial<Pick<BuildResult, "name" | "tagline" | "summary" | "direction" | "palette">>;

function parseMeta(raw: string, brief?: string, retained?: RetainedMetadata): Omit<BuildResult, "html" | "files"> {
  const hashed = fallbackPaletteFromBrief(brief || "studio");
  const defaults = {
    name: asText(retained?.name, "Studio"),
    tagline: asText(retained?.tagline, "", 120),
    kind: "app" as ProjectKind,
    summary: asText(retained?.summary, "", 280),
    direction: asText(retained?.direction, "", 80),
    palette: {
      bg: asHex(retained?.palette?.bg, hashed.bg),
      surface: asHex(retained?.palette?.surface, hashed.surface),
      fg: asHex(retained?.palette?.fg, hashed.fg),
      muted: asHex(retained?.palette?.muted, hashed.muted),
      accent: asHex(retained?.palette?.accent, hashed.accent),
    },
  };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const paletteIn =
      data.palette && typeof data.palette === "object"
        ? (data.palette as Record<string, unknown>)
        : {};
    return {
      name: asText(data.name, defaults.name),
      tagline: asText(data.tagline, defaults.tagline, 120),
      kind: asKind(data.kind),
      summary: asText(data.summary, defaults.summary, 280),
      direction: asText(data.direction, defaults.direction, 80),
      palette: {
        bg: asHex(paletteIn.bg, defaults.palette.bg),
        surface: asHex(paletteIn.surface, defaults.palette.surface),
        fg: asHex(paletteIn.fg, defaults.palette.fg),
        muted: asHex(paletteIn.muted, defaults.palette.muted),
        accent: asHex(paletteIn.accent, defaults.palette.accent),
      },
    };
  } catch {
    return defaults;
  }
}

function extractHtml(text: string) {
  const doctype = text.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
  if (doctype) return doctype[0];
  const html = text.match(/<html[\s\S]*<\/html>/i);
  if (html) return `<!DOCTYPE html>\n${html[0]}`;
  return "";
}

// Refinement callers retain existing metadata when a style/icon-only response
// omits it. Initial creation keeps its existing brief-based defaults.
export function parseBuildOutput(text: string, lockKind?: ProjectKind, brief?: string, retained?: RetainedMetadata): BuildResult | null {
  const trimmed = text.trim();
  const metaBlock = trimmed.match(/<<<META>>>\s*([\s\S]*?)(?:<<<HTML>>>|<<<FILE |$)/);
  const htmlBlock = trimmed.match(/<<<HTML>>>\s*([\s\S]*?)(?:<<<FILE |<<<END>>>|$)/);
  let files = parseProjectFiles(trimmed);

  let html = "";
  if (htmlBlock) html = extractHtml(htmlBlock[1] ?? "") || htmlBlock[1]?.trim() || "";
  if (!html) html = assembleHtml(files) || extractHtml(trimmed);

  if (!html || html.length < 80) return null;
  if (!/<\/html>/i.test(html)) html = `${html}\n</body>\n</html>`;

  const meta = parseMeta(metaBlock?.[1]?.trim() || "{}", brief, retained);
  if (lockKind) meta.kind = lockKind;
  if (meta.name === "Studio") {
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    if (title) meta.name = title.slice(0, 80);
  }

  if (!files.some((f) => f.path === "index.html")) {
    files = ingestProjectFiles([{ path: "index.html", content: html }, ...files], { html }).files;
  } else {
    files = ingestProjectFiles(files, { html }).files;
  }

  if (isPhoneKind(meta.kind)) {
    files = ensureScreenFiles(files, html);
    files = seedFiveScreens(files, html, metaBlock ? undefined : "App");
    html = assembleHtml(files, html) || html;
    files = seedFiveScreens(files, html, meta.name);
    html = assembleHtml(files, html) || html;
    files = fenix2Files(files, { name: meta.name, palette: meta.palette });
    files = ingestProjectFiles(files, { html }).files;
  } else {
    files = ingestProjectFiles(dropPhoneScreenFiles(files), { html }).files;
  }

  html = enforceGraphicIntent(html, brief || "");
  files = files.map((f) =>
    f.path === "index.html" ? { ...f, content: enforceGraphicIntent(f.content, brief || "") } : f,
  );

  return { ...meta, html, files };
}
