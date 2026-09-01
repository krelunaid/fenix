import {
  ENTRYPOINT,
  MAX_PROJECT_FILES,
  entrypointOf,
  fileLooksLikeSecret,
  ingestProjectFiles,
  projectFiles,
  utf8Bytes,
  type ProjectFile,
} from "./files.ts";

export const MAX_PROJECT_ARCHIVE_BYTES = 2_000_000;

function crc32(data: Uint8Array) {
  let c = ~0 >>> 0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  b[0] = n & 255;
  b[1] = (n >>> 8) & 255;
  return b;
}

function u32(n: number) {
  const b = new Uint8Array(4);
  b[0] = n & 255;
  b[1] = (n >>> 8) & 255;
  b[2] = (n >>> 16) & 255;
  b[3] = (n >>> 24) & 255;
  return b;
}

export function treeFileHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export type TreeManifest = {
  v: 1;
  entrypoint: string;
  kind?: string;
  name?: string;
  files: { path: string; hash: string; bytes: number }[];
};

function manifestName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return name && !fileLooksLikeSecret(name, "fenix.json") ? name : undefined;
}

export function treeManifest(
  files: ProjectFile[],
  meta?: { kind?: string; name?: string },
): TreeManifest {
  const tree = projectFiles({ files });
  const name = manifestName(meta?.name);
  return {
    v: 1,
    entrypoint: entrypointOf(tree) || ENTRYPOINT,
    ...(meta?.kind ? { kind: meta.kind } : {}),
    ...(name ? { name } : {}),
    files: tree.map((f) => ({
      path: f.path,
      hash: treeFileHash(f.content),
      bytes: utf8Bytes(f.content),
    })),
  };
}

export function zipFiles(files: { path: string; content: string }[]) {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(file.path.replace(/^\/+/, ""));
    const body = enc.encode(file.content);
    const crc = crc32(body);
    const local = new Uint8Array(30 + name.length + body.length);
    local.set([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    local.set(u32(crc), 14);
    local.set(u32(body.length), 18);
    local.set(u32(body.length), 22);
    local.set(u16(name.length), 26);
    local.set(name, 30);
    local.set(body, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    central.set([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    central.set(u32(crc), 16);
    central.set(u32(body.length), 20);
    central.set(u32(body.length), 24);
    central.set(u16(name.length), 28);
    central.set(u32(offset), 42);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  end.set([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0]);
  end.set(u16(files.length), 8);
  end.set(u16(files.length), 10);
  end.set(u32(centralSize), 12);
  end.set(u32(offset), 16);

  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of locals) {
    out.set(part, p);
    p += part.length;
  }
  for (const part of centrals) {
    out.set(part, p);
    p += part.length;
  }
  out.set(end, p);
  return out;
}

/** Canonical tree + reproducible fenix.json. Never secrets, never prompt/messages. */
export function zipProject(
  files: ProjectFile[],
  meta?: { kind?: string; name?: string },
): Uint8Array {
  const tree = projectFiles({ files });
  const manifest = treeManifest(tree, meta);
  return zipFiles([
    { path: "fenix.json", content: `${JSON.stringify(manifest, null, 2)}\n` },
    ...tree.filter((f) => f.path !== "fenix.json"),
  ]);
}

export function unzipFiles(buf: Uint8Array): { path: string; content: string }[] {
  const dec = new TextDecoder();
  const out: { path: string; content: string }[] = [];
  let i = 0;
  while (i + 30 <= buf.length) {
    if (buf[i] !== 0x50 || buf[i + 1] !== 0x4b) break;
    if (buf[i + 2] === 0x01 && buf[i + 3] === 0x02) break;
    if (buf[i + 2] === 0x05 && buf[i + 3] === 0x06) break;
    if (buf[i + 2] !== 0x03 || buf[i + 3] !== 0x04) break;
    const nameLen = buf[i + 26]! | (buf[i + 27]! << 8);
    const extraLen = buf[i + 28]! | (buf[i + 29]! << 8);
    const bodyLen =
      buf[i + 22]! | (buf[i + 23]! << 8) | (buf[i + 24]! << 16) | (buf[i + 25]! << 24);
    const nameStart = i + 30;
    const name = dec.decode(buf.subarray(nameStart, nameStart + nameLen));
    const bodyStart = nameStart + nameLen + extraLen;
    const body = dec.decode(buf.subarray(bodyStart, bodyStart + bodyLen));
    out.push({ path: name, content: body });
    i = bodyStart + bodyLen;
  }
  return out;
}

export function unzipProject(buf: Uint8Array): {
  files: ProjectFile[];
  manifest: TreeManifest | null;
} {
  const raw = unzipFiles(buf);
  const man = raw.find((f) => f.path === "fenix.json");
  let manifest: TreeManifest | null = null;
  if (man) {
    try {
      const parsed = JSON.parse(man.content) as TreeManifest;
      if (parsed && parsed.v === 1 && typeof parsed.entrypoint === "string") manifest = parsed;
    } catch {
      manifest = null;
    }
  }
  return {
    files: projectFiles({ files: raw.filter((f) => f.path !== "fenix.json") }),
    manifest,
  };
}

export type ProjectArchiveResult =
  { ok: true; files: ProjectFile[]; manifest: TreeManifest } | { ok: false; error: string };

function readU16(buf: Uint8Array, at: number): number {
  return buf[at]! | (buf[at + 1]! << 8);
}

function readU32(buf: Uint8Array, at: number): number {
  return (buf[at]! | (buf[at + 1]! << 8) | (buf[at + 2]! << 16) | (buf[at + 3]! << 24)) >>> 0;
}

/**
 * Strict reader for archives created by Fenix. Only stored UTF-8 entries are
 * accepted, so compressed bombs, data descriptors and partial imports never
 * reach the project store. The manifest is checked against every accepted file.
 */
export function importProjectArchive(buf: Uint8Array): ProjectArchiveResult {
  if (!(buf instanceof Uint8Array) || buf.length < 22) {
    return { ok: false, error: "Archivio ZIP vuoto o incompleto." };
  }
  if (buf.length > MAX_PROJECT_ARCHIVE_BYTES) {
    return { ok: false, error: "Archivio ZIP troppo grande." };
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const raw: { path: string; content: string }[] = [];
  const paths = new Set<string>();
  let at = 0;
  let central = false;
  try {
    while (at + 4 <= buf.length) {
      const signature = readU32(buf, at);
      if (signature === 0x02014b50 || signature === 0x06054b50) {
        central = true;
        break;
      }
      if (signature !== 0x04034b50 || at + 30 > buf.length) {
        return { ok: false, error: "Struttura ZIP non valida." };
      }
      const flags = readU16(buf, at + 6);
      const method = readU16(buf, at + 8);
      const crc = readU32(buf, at + 14);
      const packed = readU32(buf, at + 18);
      const unpacked = readU32(buf, at + 22);
      const nameLength = readU16(buf, at + 26);
      const extraLength = readU16(buf, at + 28);
      if (flags !== 0 || method !== 0 || packed !== unpacked) {
        return { ok: false, error: "Il ZIP non è un export Fenix supportato." };
      }
      const nameStart = at + 30;
      const bodyStart = nameStart + nameLength + extraLength;
      const end = bodyStart + unpacked;
      if (!nameLength || bodyStart < nameStart || end < bodyStart || end > buf.length) {
        return { ok: false, error: "Archivio ZIP troncato." };
      }
      const path = decoder.decode(buf.subarray(nameStart, nameStart + nameLength));
      const key = path.toLowerCase();
      if (!path || path.endsWith("/") || paths.has(key)) {
        return { ok: false, error: "Percorsi duplicati o non validi nel ZIP." };
      }
      const bytes = buf.subarray(bodyStart, end);
      if (crc32(bytes) !== crc) return { ok: false, error: `Checksum non valido: ${path}.` };
      raw.push({ path, content: decoder.decode(bytes) });
      paths.add(key);
      if (raw.length > MAX_PROJECT_FILES + 1) {
        return { ok: false, error: "Troppi file nell'archivio ZIP." };
      }
      at = end;
    }
  } catch {
    return { ok: false, error: "Il ZIP contiene testo non UTF-8." };
  }
  if (!central || raw.length < 2) {
    return { ok: false, error: "Archivio ZIP incompleto." };
  }

  const manifests = raw.filter((file) => file.path === "fenix.json");
  if (manifests.length !== 1) {
    return { ok: false, error: "Manca il manifest fenix.json univoco." };
  }
  let manifest: TreeManifest;
  try {
    manifest = JSON.parse(manifests[0]!.content) as TreeManifest;
  } catch {
    return { ok: false, error: "fenix.json non è JSON valido." };
  }
  if (
    !manifest ||
    manifest.v !== 1 ||
    manifest.entrypoint !== ENTRYPOINT ||
    !Array.isArray(manifest.files) ||
    manifest.files.length < 1 ||
    manifest.files.length > MAX_PROJECT_FILES
  ) {
    return { ok: false, error: "Manifest Fenix non supportato." };
  }
  if (
    manifest.name !== undefined &&
    (manifest.name !== manifestName(manifest.name) || manifest.name.length > 80)
  ) {
    return { ok: false, error: "Nome progetto non valido nel manifest." };
  }

  const source = raw.filter((file) => file.path !== "fenix.json");
  const ingested = ingestProjectFiles(source);
  if (ingested.rejected.length || ingested.files.length !== source.length) {
    const why = ingested.rejected[0]?.reason || "albero non valido";
    return { ok: false, error: `File rifiutato: ${why}.` };
  }
  if (!ingested.files.some((file) => file.path === ENTRYPOINT)) {
    return { ok: false, error: "Manca index.html." };
  }

  const actual = new Map(ingested.files.map((file) => [file.path, file]));
  const declared = new Set<string>();
  for (const item of manifest.files) {
    if (
      !item ||
      typeof item.path !== "string" ||
      typeof item.hash !== "string" ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 1 ||
      declared.has(item.path)
    ) {
      return { ok: false, error: "Elenco file non valido in fenix.json." };
    }
    declared.add(item.path);
    const file = actual.get(item.path);
    if (
      !file ||
      utf8Bytes(file.content) !== item.bytes ||
      treeFileHash(file.content) !== item.hash
    ) {
      return { ok: false, error: `Manifest non corrispondente: ${item.path}.` };
    }
  }
  if (declared.size !== actual.size) {
    return { ok: false, error: "Il ZIP contiene file non dichiarati." };
  }
  return { ok: true, files: ingested.files, manifest };
}
