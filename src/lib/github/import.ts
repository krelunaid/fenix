import { MAX_FILE_BYTES, MAX_PROJECT_FILES, MAX_TREE_BYTES } from "../projects/files.ts";
import { importProjectTree, type TreeManifest } from "../projects/zip.ts";
import {
  dropToken,
  getBlobUtf8,
  getCommitTreeSha,
  getRecursiveTreeEntries,
  getRef,
  isGhError,
  listInstallationRepos,
  mintInstallationToken,
  type GhError,
  type GitHubTreeEntry,
} from "./api.ts";
import { contentHashOf, parseBranch, parseRepo } from "./tree.ts";
import type { PublicImportJob } from "./types.ts";

function supportedBlob(entry: GitHubTreeEntry | undefined): entry is GitHubTreeEntry {
  return Boolean(
    entry &&
    entry.type === "blob" &&
    entry.mode === "100644" &&
    /^[0-9a-f]{40,64}$/i.test(entry.sha) &&
    Number.isSafeInteger(entry.size) &&
    entry.size > 0 &&
    entry.size <= MAX_FILE_BYTES,
  );
}

function declaredManifest(text: string): TreeManifest | null {
  try {
    const parsed = JSON.parse(text) as TreeManifest;
    if (
      !parsed ||
      parsed.v !== 1 ||
      parsed.entrypoint !== "index.html" ||
      !Array.isArray(parsed.files) ||
      parsed.files.length < 1 ||
      parsed.files.length > MAX_PROJECT_FILES
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Pull a Fenix-authored GitHub tree into a bounded public package. The short-lived
 * installation token never leaves this server call and is never persisted.
 */
export async function importFromGitHub(input: {
  installationId: string;
  repo: string;
  branch: string;
}): Promise<PublicImportJob | GhError> {
  const parsedRepo = parseRepo(input.repo);
  const branch = parseBranch(input.branch);
  if (!parsedRepo) return { error: "Repository non valido.", status: 400 };
  if (!branch) return { error: "Branch non valido.", status: 400 };

  const token = await mintInstallationToken(input.installationId);
  if (isGhError(token)) return token;
  try {
    const repos = await listInstallationRepos(token);
    if (isGhError(repos)) return repos;
    if (!repos.some((repo) => repo.fullName === parsedRepo.fullName)) {
      return { error: "Repository non accessibile a questa installazione.", status: 403 };
    }
    const ref = await getRef(token, parsedRepo.fullName, branch);
    if (isGhError(ref)) return ref;
    if (!ref) return { error: "Branch GitHub vuoto o inesistente.", status: 404 };
    const treeSha = await getCommitTreeSha(token, parsedRepo.fullName, ref.sha);
    if (isGhError(treeSha)) return treeSha;
    const tree = await getRecursiveTreeEntries(token, parsedRepo.fullName, treeSha);
    if (isGhError(tree)) return tree;
    if (tree.truncated) {
      return { error: "Albero GitHub troncato: importazione fermata.", status: 422 };
    }

    const manifestEntries = tree.entries.filter((entry) => entry.path === "fenix.json");
    if (manifestEntries.length !== 1 || !supportedBlob(manifestEntries[0])) {
      return { error: "Manca un fenix.json leggibile e univoco.", status: 422 };
    }
    const manifestText = await getBlobUtf8(
      token,
      parsedRepo.fullName,
      manifestEntries[0]!.sha,
      MAX_FILE_BYTES,
    );
    if (isGhError(manifestText)) return manifestText;
    const manifest = declaredManifest(manifestText);
    if (!manifest) return { error: "Manifest Fenix non supportato.", status: 422 };

    const byPath = new Map(tree.entries.map((entry) => [entry.path, entry]));
    const raw = [{ path: "fenix.json", content: manifestText }];
    let total = 0;
    for (const item of manifest.files) {
      if (
        !item ||
        typeof item.path !== "string" ||
        !Number.isSafeInteger(item.bytes) ||
        item.bytes < 1
      ) {
        return { error: "Elenco file non valido in fenix.json.", status: 422 };
      }
      const entry = byPath.get(item.path);
      if (!supportedBlob(entry) || entry.size !== item.bytes) {
        return { error: `File remoto assente o non valido: ${item.path}.`, status: 422 };
      }
      total += entry.size;
      if (total > MAX_TREE_BYTES) {
        return { error: "Albero GitHub troppo grande.", status: 422 };
      }
      const content = await getBlobUtf8(token, parsedRepo.fullName, entry.sha, MAX_FILE_BYTES);
      if (isGhError(content)) return content;
      raw.push({ path: item.path, content });
    }

    const verified = importProjectTree(raw);
    if (!verified.ok) return { error: verified.error, status: 422 };
    return {
      repo: parsedRepo.fullName,
      branch,
      commitSha: ref.sha,
      contentHash: contentHashOf(verified.files),
      name: verified.manifest.name,
      kind: verified.manifest.kind,
      files: verified.files,
    };
  } finally {
    dropToken(token);
  }
}
