import { mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const destination = process.argv[2];
if (!destination) throw new Error("Uso: node scripts/phase3-export-agent-job.mjs <directory> < job.json");

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const job = JSON.parse(raw);
const files = job?.result?.files;
if (!Array.isArray(files)) throw new Error("Risultato job senza files");

const root = resolve(destination);
await mkdir(root, { recursive: true });
let written = 0;
for (const file of files) {
  if (!file || typeof file.path !== "string" || typeof file.content !== "string") continue;
  const target = resolve(root, file.path);
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error(`Percorso non sicuro: ${file.path}`);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, file.content, "utf8");
  written += 1;
}

if (!written) throw new Error("Nessun file di testo esportato");
console.log(JSON.stringify({ jobId: job.id, status: job.status, destination: root, written }));
