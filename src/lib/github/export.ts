import type { ProjectFile } from "../projects/files.ts";
import { redactSecrets, assertPublicLog } from "../release/redact.ts";
import {
  createBlob,
  createCommit,
  createRef,
  createTree,
  dropToken,
  getCommitTreeSha,
  getRecursiveTree,
  getRef,
  listInstallationRepos,
  mintInstallationToken,
  seedEmptyReadme,
  updateRef,
  type GhError,
} from "./api.ts";
import {
  findExportJob,
  newExportId,
  publicJob,
  saveExportJob,
} from "./store.ts";
import { contentHashOf, exportFiles, exportPreview, parseBranch, parseRepo } from "./tree.ts";
import type { PublicExportJob, StoredExportJob } from "./types.ts";

function isFail(value: unknown): value is GhError {
  return Boolean(value && typeof value === "object" && "error" in value && "status" in value);
}

function logLine(text: string): string {
  return redactSecrets(text).slice(0, 240);
}

function htmlUrl(repo: string, sha: string): string {
  return `https://github.com/${repo}/commit/${sha}`;
}

export async function previewExport(input: {
  ownerHash: string;
  installationId: string;
  repo: string;
  branch: string;
  name: string;
  kind?: string;
  html?: string;
  files?: ProjectFile[];
}): Promise<PublicExportJob | GhError> {
  const parsedRepo = parseRepo(input.repo);
  const branch = parseBranch(input.branch);
  if (!parsedRepo) return { error: "Repository non valido.", status: 400 };
  if (!branch) return { error: "Branch non valido.", status: 400 };
  const files = exportFiles(input);
  const contentHash = contentHashOf(files);
  const preview = exportPreview(files).map((f) => ({ ...f, change: "add" as "add" | "update" }));
  const token = await mintInstallationToken(input.installationId);
  if (isFail(token)) return token;
  try {
    const repos = await listInstallationRepos(token);
    if (isFail(repos)) return repos;
    const allowed = repos.find((r) => r.fullName === parsedRepo.fullName);
    if (!allowed) return { error: "Repository non accessibile a questa installazione.", status: 403 };
    const ref = await getRef(token, parsedRepo.fullName, branch);
    if (isFail(ref)) return ref;
    if (ref) {
      const treeSha = await getCommitTreeSha(token, parsedRepo.fullName, ref.sha);
      if (!isFail(treeSha)) {
        const remote = await getRecursiveTree(token, parsedRepo.fullName, treeSha);
        if (!isFail(remote)) {
          const set = new Set(remote);
          for (const f of preview) {
            f.change = set.has(f.path) ? "update" : "add";
          }
        }
      }
    }
    return {
      id: "preview",
      status: "ok",
      repo: parsedRepo.fullName,
      branch,
      contentHash,
      files: preview,
      log: ["Anteprima locale. Nessun commit."],
    };
  } finally {
    dropToken(token);
  }
}

export async function exportToGitHub(input: {
  ownerHash: string;
  installationId: string;
  repo: string;
  branch: string;
  name: string;
  kind?: string;
  html?: string;
  files?: ProjectFile[];
}): Promise<PublicExportJob | GhError> {
  const parsedRepo = parseRepo(input.repo);
  const branch = parseBranch(input.branch);
  if (!parsedRepo) return { error: "Repository non valido.", status: 400 };
  if (!branch) return { error: "Branch non valido.", status: 400 };

  const files = exportFiles(input);
  if (!files.some((f) => f.path === "index.html")) {
    return { error: "Manca index.html. Non esporto un albero vuoto.", status: 422 };
  }
  const contentHash = contentHashOf(files);
  const existing = await findExportJob(input.ownerHash, parsedRepo.fullName, branch, contentHash);
  if (existing?.status === "ok" && existing.commitSha) {
    return { ...publicJob(existing), unchanged: true };
  }

  const job: StoredExportJob = {
    id: existing?.id || newExportId(),
    ownerHash: input.ownerHash,
    installationId: input.installationId,
    repo: parsedRepo.fullName,
    branch,
    contentHash,
    status: "run",
    files: exportPreview(files),
    log: [logLine(`Esporto ${files.length} file su ${parsedRepo.fullName}@${branch}`)],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveExportJob(job);

  const token = await mintInstallationToken(input.installationId);
  if (isFail(token)) {
    job.status = "err";
    job.error = token.error;
    job.log.push(logLine(token.error));
    await saveExportJob(job);
    return { error: token.error, status: token.status };
  }

  try {
    const repos = await listInstallationRepos(token);
    if (isFail(repos)) {
      job.status = "err";
      job.error = repos.error;
      job.log.push(logLine(repos.error));
      await saveExportJob(job);
      return repos;
    }
    if (!repos.some((r) => r.fullName === parsedRepo.fullName)) {
      job.status = "err";
      job.error = "Repository non accessibile a questa installazione.";
      job.log.push(job.error);
      await saveExportJob(job);
      return { error: job.error, status: 403 };
    }

    if (existing?.commitSha && existing.gitTreeSha) {
      const ref = await getRef(token, parsedRepo.fullName, branch);
      if (!isFail(ref) && ref?.sha === existing.commitSha) {
        job.status = "ok";
        job.unchanged = true;
        job.commitSha = existing.commitSha;
        job.gitTreeSha = existing.gitTreeSha;
        job.htmlUrl = htmlUrl(parsedRepo.fullName, existing.commitSha);
        job.log.push("Ripresa: il commit è già sul branch.");
        await saveExportJob(job);
        return publicJob(job);
      }
    }

    const entries: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];
    for (const file of files) {
      const sha = await createBlob(token, parsedRepo.fullName, file.content);
      if (isFail(sha)) {
        job.status = "err";
        job.error = sha.error;
        job.log.push(logLine(sha.error));
        await saveExportJob(job);
        return sha;
      }
      entries.push({ path: file.path, mode: "100644", type: "blob", sha });
    }
    job.log.push(logLine(`Blob: ${entries.length}`));

    const treeSha = await createTree(token, parsedRepo.fullName, entries);
    if (isFail(treeSha)) {
      job.status = "err";
      job.error = treeSha.error;
      job.log.push(logLine(treeSha.error));
      await saveExportJob(job);
      return treeSha;
    }
    job.gitTreeSha = treeSha;
    job.log.push("Tree creato.");
    await saveExportJob(job);

    if (existing?.commitSha && existing.gitTreeSha === treeSha) {
      const patched = await updateRef(token, parsedRepo.fullName, branch, existing.commitSha);
      if (!isFail(patched)) {
        job.status = "ok";
        job.commitSha = existing.commitSha;
        job.htmlUrl = htmlUrl(parsedRepo.fullName, existing.commitSha);
        job.log.push("Ripresa: stesso commit, nessun duplicato.");
        await saveExportJob(job);
        return publicJob(job);
      }
      if (patched.status === 409) {
        job.status = "err";
        job.error = patched.error;
        job.commitSha = existing.commitSha;
        job.log.push(logLine(patched.error));
        await saveExportJob(job);
        return patched;
      }
    }

    let parent: string | null = null;
    let ref = await getRef(token, parsedRepo.fullName, branch);
    if (isFail(ref)) {
      job.status = "err";
      job.error = ref.error;
      job.log.push(logLine(ref.error));
      await saveExportJob(job);
      return ref;
    }
    if (!ref) {
      const readme = files.find((f) => f.path === "README.md")?.content || "# Fenix\n";
      const seeded = await seedEmptyReadme(token, parsedRepo.fullName, branch, readme);
      if (isFail(seeded)) {
        job.status = "err";
        job.error = seeded.error;
        job.log.push(logLine(seeded.error));
        await saveExportJob(job);
        return seeded;
      }
      job.log.push("Repository vuoto: primo commit via Contents API, poi albero Fenix.");
      ref = await getRef(token, parsedRepo.fullName, branch);
      if (isFail(ref) || !ref) {
        const err = isFail(ref)
          ? ref
          : { error: "Repository vuoto: il branch non esiste ancora.", status: 409 };
        job.status = "err";
        job.error = err.error;
        job.log.push(logLine(err.error));
        await saveExportJob(job);
        return err;
      }
    }
    parent = ref.sha;
    const headTree = await getCommitTreeSha(token, parsedRepo.fullName, parent);
    if (!isFail(headTree) && headTree === treeSha) {
      job.status = "ok";
      job.unchanged = true;
      job.commitSha = parent;
      job.htmlUrl = htmlUrl(parsedRepo.fullName, parent);
      job.log.push("Stesso albero già sul branch. Nessun commit nuovo.");
      await saveExportJob(job);
      return publicJob(job);
    }

    const commitSha = await createCommit(token, parsedRepo.fullName, {
      message: `Fenix: ${input.name || "export"}`,
      tree: treeSha,
      parents: parent ? [parent] : [],
    });
    if (isFail(commitSha)) {
      job.status = "err";
      job.error = commitSha.error;
      job.log.push(logLine(commitSha.error));
      await saveExportJob(job);
      return commitSha;
    }
    job.commitSha = commitSha;
    job.log.push(logLine(`Commit ${commitSha.slice(0, 8)}`));
    await saveExportJob(job);

    const moved = await updateRef(token, parsedRepo.fullName, branch, commitSha);
    if (isFail(moved)) {
      if (moved.status === 409) {
        job.status = "err";
        job.error = moved.error;
        job.log.push(logLine(moved.error));
        await saveExportJob(job);
        return moved;
      }
      const created = await createRef(token, parsedRepo.fullName, branch, commitSha);
      if (isFail(created)) {
        job.status = "err";
        job.error = created.error;
        job.log.push(logLine(created.error));
        await saveExportJob(job);
        return created;
      }
    }

    job.status = "ok";
    job.htmlUrl = htmlUrl(parsedRepo.fullName, commitSha);
    job.log.push("Branch aggiornato. force=false.");
    assertPublicLog(job.log);
    await saveExportJob(job);
    return publicJob(job);
  } finally {
    dropToken(token);
  }
}
