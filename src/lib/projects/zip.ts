import { ENTRYPOINT, entrypointOf, projectFiles, utf8Bytes, type ProjectFile } from "./files.ts";

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

function fnv1a(text: string): string {
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
  files: { path: string; hash: string; bytes: number }[];
};

export function treeManifest(files: ProjectFile[], meta?: { kind?: string }): TreeManifest {
  const tree = projectFiles({ files });
  return {
    v: 1,
    entrypoint: entrypointOf(tree) || ENTRYPOINT,
    ...(meta?.kind ? { kind: meta.kind } : {}),
    files: tree.map((f) => ({ path: f.path, hash: fnv1a(f.content), bytes: utf8Bytes(f.content) })),
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
export function zipProject(files: ProjectFile[], meta?: { kind?: string }): Uint8Array {
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
    const bodyLen = buf[i + 22]! | (buf[i + 23]! << 8) | (buf[i + 24]! << 16) | (buf[i + 25]! << 24);
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
