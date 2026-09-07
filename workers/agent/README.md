# Fenix Agent — nucleo agentico (fetta verticale)

> Stato revisione Codex: sperimentale, NON approvato per produzione.
> Vedere `AGENT-CORE-REVIEW-2026-09-07.md` nella radice del repository.
> Un browser mancante ora fallisce il gate; le descrizioni originali qui sotto
> sullo skip positivo e sull'isolamento Docker non costituiscono prove.

Un brief entra, un agente (Claude via API Anthropic) lavora **dentro un sandbox** con strumenti reali — legge e scrive file, esegue comandi, avvia il server, chiama l'API, lancia i test, apre le pagine in Chromium — e può chiudere solo quando **tutti i controlli deterministici passano**. Esce un **progetto multi-file** (frontend + API Node + SQLite + test) che gira con `npm start` ovunque ci sia Node ≥ 22.13, senza dipendenze.

Questo modulo è indipendente dal resto di Fenix: nessun import da `src/`, nessun pacchetto npm. È pensato per sostituire, passo dopo passo, la generazione one-shot di un singolo HTML.

## Struttura

```
workers/agent/
  contract.mjs          Fenix Project v1: manifest, percorsi ammessi, limiti
  prompts.mjs           system prompt (contratto, asticella qualità, metodo di lavoro)
  tools.mjs             strumenti: list/read/write/edit/delete file, run, start_server, http, server_logs, run_checks, finish
  checks.mjs            controlli di accettazione deterministici (manifest, sintassi, avvio, pagine, API, test, browser)
  agent.mjs             il loop modello ↔ strumenti con budget, compattazione contesto, eventi
  jobs.mjs              coda job in memoria: concorrenza, TTL, annullamento, job legati al chiamante
  server.mjs            HTTP autenticato: POST /agent/build, GET/DELETE /agent/jobs/:id
  cli.mjs               prova locale senza HTTP
  model/anthropic.mjs   client Messages API (fetch puro, tool use, cache del system prompt, retry)
  model/fake.mjs        modello a copione per i test
  sandbox/local.mjs     cartella temporanea + processi (sviluppo e test; NON è isolamento)
  sandbox/docker.mjs    un container per job, stessa interfaccia (produzione)
  runtime/browser-smoke.mjs  gira DENTRO il sandbox: Chromium a 390px e 1280px, errori console, screenshot
```

## Il contratto del progetto generato

```
fenix.project.json   { version:1, name, kind:"app"|"site", start:"node server.mjs", healthPath:"/health", pages:[{path,title}], api:[{method,path}] }
package.json         type:module, scripts.start = "node server.mjs", ZERO dipendenze
server.mjs           node:http + node:sqlite ($DATA_DIR/app.db), statici da public/, /api/*, GET /health, 404 veri
public/              index.html + una pagina per voce del manifest, styles.css, app.js (vanilla, niente CDN)
tests/*.test.mjs     node:test: avvia il server su porta casuale, verifica health, pagine, API felice + errori, persistenza
```

Un esempio completo e funzionante è in `scripts/fixtures/agent-golden-project.mjs` (agenda barbiere).

## Controlli che l'agente deve superare (`run_checks`)

manifest valido · dimensioni · file obbligatori · package senza dipendenze · almeno un test · `node --check` su ogni modulo · niente testo segnaposto · il server parte e `/health` risponde `{ok:true}` · ogni pagina del manifest è 200, HTML, con doctype/lang/viewport/title/`<main>` e testo vero · percorso inesistente → 404 · ogni route API dichiarata risponde (non 404/500) · `node --test tests/` passa · smoke browser: nessun errore JS/console/richiesta fallita, nessuno scroll orizzontale a 390px, screenshot in `.fenix/shots/` (saltato con nota se Playwright non c'è).

`finish` viene **rifiutato** finché l'ultimo `run_checks` non è passato senza modifiche successive.

## Provarlo

```bash
# test (nessuna dipendenza, ~1 minuto)
npm run test:agent

# una build vera, sandbox locale, output in ./out/…
ANTHROPIC_API_KEY=sk-ant-… node workers/agent/cli.mjs "app per un barbiere con agenda e clienti" --kind app
ANTHROPIC_API_KEY=sk-ant-… node workers/agent/cli.mjs "sito per una pizzeria a Bari con menù e prenotazioni" --kind site --sandbox docker
```

Variabili: `ANTHROPIC_API_KEY` (obbligatoria), `ANTHROPIC_MODEL` (default `claude-sonnet-4-5`: verifica l'id corrente su docs.claude.com/en/docs/about-claude/models), `AGENT_SANDBOX=local|docker`, `AGENT_DOCKER_IMAGE` (default immagine Playwright con Node 22 e Chromium), `AGENT_BROWSER_CHECKS=0` per saltare lo smoke browser.

## Server

```bash
AGENT_TOKEN=$(openssl rand -hex 24) ANTHROPIC_API_KEY=… AGENT_SANDBOX=docker FENIX_ORIGIN=https://fenix.kreluna.it node workers/agent/server.mjs
```

- Tutte le rotte tranne `GET /health` richiedono `Authorization: Bearer $AGENT_TOKEN` (confronto a tempo costante).
- I job sono legati all'header `x-fenix-owner`: un altro chiamante riceve 404.
- `POST /agent/build` `{ brief, kind, name?, extras?, files?, instruction? }` → `202 { id }`; con `files` + `instruction` è una **modifica** di un progetto esistente (l'agente legge i file e cambia solo il necessario).
- `GET /agent/jobs/:id` → stato, ultimi eventi, esito, ricevuta dei controlli, elenco file; `?full=1` include contenuti ed eventi completi.
- `DELETE /agent/jobs/:id` annulla (segnale di abort al loop, container distrutto).
- Coda con `AGENT_CONCURRENCY` lavori in parallelo (default 2) e 429 oltre 20 in attesa; job cancellati dopo un'ora.

## Dove farlo girare

Il sandbox Docker richiede un **demone Docker sull'host**. Railway (come Fly, Render, Netlify) non offre Docker-in-Docker nei servizi normali, quindi le opzioni reali sono:

1. **Una VM con Docker** (Hetzner/OVH/Scaleway, da ~5 €/mese): `node workers/agent/server.mjs` sotto systemd, `AGENT_SANDBOX=docker`, `docker pull mcr.microsoft.com/playwright:v1.55.0-noble` una volta. È la strada consigliata per iniziare.
2. **Railway con `AGENT_SANDBOX=local`**: funziona subito, ma i job non sono isolati tra loro né dall'host (il modello può eseguire comandi arbitrari nel container del servizio). Accettabile solo per prove interne.
3. **Sandbox a consumo** (E2B, Daytona): da implementare come terza classe con la stessa interfaccia di `LocalSandbox` (`exec`, `spawnServer`, `fetch`, file).

## Integrazione con Fenix (prossimi passi)

1. Netlify: una route `/api/agent/*` che inoltra al server con `AGENT_TOKEN` dal lato server (mai nel client) e applica i crediti.
2. Studio: nuovo tipo di progetto «repository» (i `files` esistono già in `src/lib/projects/files.ts`); anteprima da `public/index.html` + API in un iframe puntato a un'istanza avviata del progetto.
3. Modifiche: `POST /agent/build` con `files` + `instruction` al posto della rigenerazione integrale.
4. Export/deploy: lo ZIP è già il progetto; `fenix.deploy.json` può puntare a Fly/Railway per le app full-stack.

## Limiti noti di questa fetta

- Un solo modello (Anthropic); il BYOK multi-modello si aggiunge implementando `complete()` per altri provider.
- Il progetto generato è vanilla JS + node:sqlite per essere a zero dipendenze: niente React, niente Postgres. È una scelta per l'affidabilità del primo passo, non un limite architetturale.
- La stima di costo usa prezzi indicativi (`model/anthropic.mjs`): aggiornare la tabella al modello scelto.
- Lo smoke browser richiede Playwright nel sandbox (presente nell'immagine Docker di default; assente nel sandbox locale se non installato).
