# Fenix agent core — experimental integration

This module is not wired into Fenix Studio and does not replace the production xAI worker. Publishing its source does not activate Anthropic generations. No 10/10 or product-level parity is claimed.

## Architecture

A brief enters the tool loop; the model creates a multi-file Node/SQLite project, executes checks, and returns files and a receipt. Contract: `fenix.project.json`, `server.mjs`, `public/`, `tests/*.test.mjs`, dependency-free generated app. Local fixtures use Node >=22.13.

The Docker adapter now stores files only inside bounded tmpfs volumes. No host bind mount, no published port, read-only root filesystem, non-root uid, dropped capabilities, and `--network none`. HTTP probes execute inside Docker. Container file operations never read a generated path on the host. File APIs reject symlinks. The local adapter is only for reviewed fixture tests and is not a security boundary.

Build the test image explicitly:
```sh
docker build -t fenix-agent-sandbox:local workers/agent/sandbox
FENIX_TEST_DOCKER=1 npm run test:agent
```

CI workflow `agent-isolation` runs the real container, egress denial, project health, browser smoke and file checks. Without FENIX_TEST_DOCKER the real test is explicitly skipped, not proven.

## Tests and limits

`npm run test:agent` covers the fake-model loop, API, owner validation, abort/deadline, lexical/symlink paths, check failures and Docker argument plumbing. The Docker argument fixture never executes project code on the host and is not isolation evidence.

Browser absence, nonzero smoke exit, empty/duplicate/missing views, non-200 responses and missing screenshots fail the browser gate. TAP output is explicit. These are structural/smoke checks, not independent proof of every business requirement or premium design. Model-written tests and browser receipts in the same project execution environment are not a tamper-resistant verifier.

Abort interrupts pending model/tool waits; local commands receive a kill signal; Docker cancellation destroys the container. Aborted runs do not export potentially changing files. The job store is still in-memory, not durable across worker restarts.

## HTTP deployment boundary

The CLI defaults to Docker and refuses local generation. Direct HTTP startup requires AGENT_SANDBOX=docker and binds to loopback. AGENT_TOKEN is server-only and must never be sent to a browser. Every non-health request requires a valid x-fenix-owner; there is no anonymous fallback.

The owner header is a trusted-proxy assertion, NOT authentication by itself. The pending Studio proxy must derive it from a verified user session, overwrite untrusted inbound headers and charge/refund credits on the server. No such integration is activated by this branch.

## Studio proxy (added 2026-09-07)

`/api/agent/*` — `netlify/functions/agent-proxy.ts` in production, `src/routes/api/agent.$.ts` in dev — is the trusted proxy this worker expects. It holds `AGENT_URL`/`AGENT_TOKEN` server-side, sets `x-fenix-owner` itself from the caller's identity (today the owner capability; `resolveOwner` in `src/lib/agent/http.ts` is the one place to swap in a verified session) and enforces credits on the server (`src/lib/agent/credits-store.ts`: Netlify Blobs, 100 grant, 4 per create, 2 per edit, refund once on failure/cancel). `npm run test:agent-proxy` runs it against this server with a scripted model.

## Durable jobs and published apps (added 2026-09-07)

With `AGENT_DATA_DIR` set on the agent host, finished jobs are written to `<dir>/jobs/<id>.json` (7-day TTL) and survive restarts. `POST /agent/sites { jobId, slug? }` publishes a finished job under a public slug; the record and the app's SQLite data live in `<dir>/sites/` — the data directory is the only bind mount the sandbox ever receives (`/work/.fenix/data`, uid 1000). Published apps start on first request and stop after 10 idle minutes; data persists on the host. Fenix serves them at `/app/<slug>/…` (`netlify/functions/app-public.ts`, `src/routes/app.$slug.$.tsx`) with paths rewritten to that prefix. Owners list/delete their sites via `/api/agent/sites`.

## Models and BYOK (added 2026-09-07)

`workers/agent/model/index.mjs` picks the provider: `AGENT_PROVIDER=anthropic|openai|xai` with the matching `*_API_KEY` (server BYOK), or per request from the Studio (`x-fenix-model-provider`, `x-fenix-model-key`, `x-fenix-model` — user BYOK, kept in memory for that job only, never logged or stored; the Studio keeps the key in sessionStorage of the tab). `model/openai.mjs` translates the Anthropic-style tool loop to Chat Completions with function tools (OpenAI, xAI Grok 4, compatible proxies). One note: `grok-build-0.1` is not a tool-calling model and is not supported here.

## Icons (added 2026-09-08)

`icon-set.mjs` embeds the full Lucide set (1800+ icons, ISC licence in the file header; regenerate with `node scripts/build-icon-set.mjs <lucide-clone>`), and `icons.mjs` resolves Italian/English words to icon names ("prenotazioni" → `calendar-check`, "chiave inglese" → `wrench`). The agent has an `icons` tool that returns inline `<svg>` markup or writes `public/icons.svg` as a sprite, and the system prompt forbids emoji as UI icons. The same two files live in `workers/visual/` (the visual worker deploys from its own folder) where the atomic icon patch falls back to Lucide when the 22 house pictograms do not match. `scripts/icon-set.test.mjs` asserts the copies are identical. Apple's SF Symbols are not used: their licence restricts them to Apple platforms.

## Independent acceptance (added 2026-09-08)

`workers/agent/acceptance.mjs` adds gate checks the model cannot satisfy by writing its own tests: `ui:static` (one `<h1>`, labelled fields, no emoji icons, no mute buttons, no `href="#"`, no external scripts beyond Google Fonts), `server:static` (node:sqlite present, no SQL built from variables, no eval/child_process), `security:probe` (path traversal, project files not served, malformed JSON → 400, 600 KB body and wrong methods do not crash, `/health` still answers) and `persistence` (two boots on the same DATA_DIR, a `.db` file on disk, identical GET responses after restart). These run in `runChecks` before the project's own tests and are reported in the same receipt. They are structural probes, not proof of business correctness.

## Backup and restore (added 2026-09-08)

`workers/agent/backup.mjs` snapshots `AGENT_DATA_DIR` into `AGENT_BACKUP_DIR/<stamp>/`: site records, finished jobs, uploads, and every app database copied with SQLite `VACUUM INTO` (consistent while the app is running; WAL side files folded in). Each snapshot carries a `manifest.json` with SHA-256 per file; `verify` re-checks hashes and `PRAGMA integrity_check`. `restore <dir> [--only slug]` runs with the agent stopped, replaces only the slugs in the snapshot and moves the previous data to `<data>/.restore-trash/<stamp>/` instead of deleting it. `install-vm.sh` enables `fenix-agent-backup.timer` (hourly, `AGENT_BACKUP_KEEP=48`). `POST /agent/admin/backups` (token only) triggers a snapshot; `GET` lists them. Off-site copy is up to the operator (e.g. `rclone sync /var/backups/fenix-agent remote:fenix`).

## Going live (added 2026-09-07)

Fresh Ubuntu VM: `bash workers/agent/deploy/install-vm.sh` (Docker, Node 22, sandbox image, systemd unit `fenix-agent`, `/etc/fenix-agent.env` with a generated `AGENT_TOKEN`, data in `/var/lib/fenix-agent`), fill `ANTHROPIC_API_KEY`, `systemctl restart fenix-agent`, put Caddy in front (`deploy/Caddyfile.example`, DNS `agent.kreluna.it`). On Netlify set `AGENT_URL=https://agent.kreluna.it` and the same `AGENT_TOKEN`. `workers/agent/Dockerfile` builds the host itself as a container (needs the host Docker socket).

## Remaining work before enabling customer traffic

- Real model generation with a server-only Anthropic key (not provided in this environment).
- Recovery UX, custom domains for published apps, off-site copy of backups.
- Brief-based acceptance beyond structure: real login flows, per-user isolation, design review.
- Durable job persistence, operational monitoring and independent validation outside the generated project.
- Provision an explicitly authorized host with Docker; no infrastructure purchases are automatic.

Historical findings are in AGENT-CORE-REVIEW-2026-09-07.md. That report describes the original checkpoint, not the current corrected code.
