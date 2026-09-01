import { createHash } from "node:crypto";
import { fileLooksLikeSecret, projectFiles, utf8Bytes, type ProjectFile } from "../projects/files.ts";
import { treeManifest } from "../projects/zip.ts";

export function parseRepo(
  raw: string | null | undefined,
): { owner: string; name: string; fullName: string } | null {
  const s = String(raw || "").trim();
  const m = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/.exec(s);
  if (!m) return null;
  const owner = m[1]!;
  const name = m[2]!;
  if (name.endsWith(".git") || name === "." || name === "..") return null;
  if (owner.length > 39) return null;
  return { owner, name, fullName: `${owner}/${name}` };
}

export function parseBranch(raw: string | null | undefined): string | null {
  const b = String(raw || "").trim();
  if (!b || b.length > 200) return null;
  if (b === "HEAD" || /^refs\//i.test(b)) return null;
  if (b.startsWith("/") || b.endsWith("/") || b.startsWith(".") || b.endsWith(".")) return null;
  if (b.includes("..") || b.includes("//") || b.includes("@{") || b.endsWith(".lock")) return null;
  if (!/^[A-Za-z0-9._/-]+$/.test(b)) return null;
  return b;
}

export function parseInstallationId(raw: string | null | undefined): string | null {
  const id = String(raw || "").trim();
  return /^[0-9]{1,20}$/.test(id) ? id : null;
}

export function buildReadme(name: string, files: ProjectFile[]): string {
  const title = String(name || "Progetto").replace(/[\r\n#]+/g, " ").trim() || "Progetto";
  const list = files
    .slice(0, 24)
    .map((f) => `- \`${f.path}\``)
    .join("\n");
  return `# ${title}

Esportato da Fenix.

- Entrypoint: \`index.html\`
- Apri \`index.html\` nel browser. Non serve un server.
- I file extra (css, js, JSON, componenti) stanno nell'albero. Anteprima e pubblicazione Fenix eseguono solo l'HTML validato.

Questo commit non contiene chiavi, token, chat o credenziali.

## File

${list || "- \`index.html\`"}
`;
}

/** Canonical POSIX tree for GitHub: project files + fenix.json + README. No secrets. */
export function exportFiles(input: {
  name: string;
  kind?: string;
  html?: string;
  files?: ProjectFile[];
}): ProjectFile[] {
  const tree = projectFiles({ html: input.html, files: input.files });
  const manifest = treeManifest(tree, { kind: input.kind });
  const out: ProjectFile[] = [
    { path: "fenix.json", content: `${JSON.stringify(manifest, null, 2)}\n` },
  ];
  const hasReadme = tree.some((f) => f.path.toLowerCase() === "readme.md");
  for (const f of tree) {
    if (fileLooksLikeSecret(f.content, f.path)) continue;
    out.push(f);
  }
  if (!hasReadme) out.push({ path: "README.md", content: buildReadme(input.name, tree) });
  return out;
}

export function contentHashOf(files: ProjectFile[]): string {
  const h = createHash("sha256");
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    h.update(f.path);
    h.update("\0");
    h.update(f.content);
    h.update("\n");
  }
  return h.digest("hex");
}

export function exportPreview(files: ProjectFile[]): { path: string; bytes: number }[] {
  return files.map((f) => ({ path: f.path, bytes: utf8Bytes(f.content) }));
}

export function exportIdempotencyKey(
  ownerHash: string,
  repo: string,
  branch: string,
  contentHash: string,
): string {
  return createHash("sha256")
    .update(`fenix-gh-export:${ownerHash}:${repo}:${branch}:${contentHash}`)
    .digest("hex");
}
