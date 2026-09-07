# Fenix

Studio visivo Kreluna. Usa **grok-build-0.1** per tutte le chiamate xAI (piano, direzione visiva, build, QA, worker Railway). Niente `reasoningEffort`. Endpoint: `https://api.x.ai/v1/chat/completions`. Il piano è deterministico (contratto di build, 0 token); critic/QA LLM scatta solo se i gate statici e grafici sono incompleti. Compilare non basta per ready/pubblica.

Prove pronte: **Fornace Grottaglie**, **Officina Catenaria**.

## Repo

[github.com/krelunaid/fenix](https://github.com/krelunaid/fenix)

## Chiave xAI

La chiave è esclusivamente server-side. Mai `VITE_XAI_API_KEY`, mai nel frontend, mai nel repository e mai nel README con il valore.

| Nome                | Dove   | Note                                                                             |
| ------------------- | ------ | -------------------------------------------------------------------------------- |
| `XAI_API_KEY`       | server | Tua, creata su [console.x.ai](https://console.x.ai)                              |
| `VISUAL_WORKER_URL` | server | Opzionale. Worker Playwright. Es. `https://fenix-production-d9f5.up.railway.app` |
| `VISUAL_WORKER_TOKEN` | server + Railway | Segreto condiviso: Fenix lo aggiunge lato server, il worker rifiuta i job senza. Mai nel client. |
| `FENIX_ORIGIN` | server + Railway | Origine pubblica (es. `https://fenix.kreluna.it`): guardia origin su `/api/build`, CORS del worker. |
| `VITE_AUTH_ENABLED` | build  | `false` di default in locale. Per Gmail/email metti `true` e `DATABASE_URL`      |

## Configurazione Netlify

1. Apri [console.x.ai](https://console.x.ai), abilita **Credits/Billing** a pagamento e crea una nuova API key.
2. In Netlify apri **Site settings → Environment variables**.
3. Aggiungi la chiave come secret server-side con nome esatto `XAI_API_KEY`.
4. Non usare `VITE_XAI_API_KEY` e non inserire mai il valore nel repository o nel frontend.
5. Collega questo repository, configura il dominio (es. `fenix.kreluna.it`) e avvia il deploy.

Se il secret non è configurato, Fenix risponde chiaramente: `Manca XAI_API_KEY sul server`.

Export + pull Fenix da GitHub (opzionale, server only): `GITHUB_APP_ID` (o `GITHUB_APP_CLIENT_ID`), `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG` **e** `DATABASE_URL` con la migrazione `0003_github_connect_nonces`. Setup URL della App: `https://fenix.kreluna.it/api/github/callback`, con **«Request user authorization (OAuth) during installation»** attivo e `GITHUB_APP_CLIENT_ID` + `GITHUB_APP_CLIENT_SECRET` sul server (il callback verifica che l'installazione appartenga a chi si collega). Permessi minimi Contents + Metadata; i token sono limitati per operazione. Le sole chiavi App non bastano: Studio resta su **GitHub non configurato**. Il pull accetta soltanto alberi Fenix con manifest/checksum validi e crea uno studio isolato; ZIP locale resta. Dettagli: [`src/lib/github/references.md`](src/lib/github/references.md).

Le app generate (Grottaglie, Catenaria, …) si scaricano da **Pubblica** (ZIP / `index.html`) e si caricano sul sito come HTML statico. **Pubblica** resta disabilitata finché il documento finale (srcdoc compreso il runtime) non è valido.

Le app pubblicate possono usare **Collabora sui dati**: il titolare genera link revocabili in sola lettura o modifica per un archivio cloud condiviso. La capability viene mostrata una volta, conservata nel database soltanto come hash e scambiata con un cookie HttpOnly limitato all'API dati. Non servono account esterni.

Lo **studio condiviso** è un workspace progetto distinto: il titolare invita viewer/editor, il viewer legge albero e appunti, editor e titolare scrivono file con If-Match CAS e un documento testuale con insert/delete server-authoritative (op id, base/versione, idempotenza). Parti indipendenti convergono; conflitti stale falliscono chiusi. Inviti one-shot hash-only, revoca immediata, presenza TTL, registro redatto. Serve `DATABASE_URL` con le migrazioni `0006_project_workspaces` e `0007_workspace_shared_doc`. Non è un CRDT su ogni file e non dichiara parità con Emergent.

Un brief **full-stack** esplicito esporta un'app avviabile con `npm start`: frontend e API Node+SQLite sulla stessa origine, `GET /health`, `fenix.deploy.json` e migrazioni in `backend/migrations/` (forward-only, idempotenti). Include signup/login, recupero password e accesso passwordless magic-link/OTP con outbox SQLite, senza SMTP. Il codice server del modello non entra nel tree. Non è un database distribuito.



## Locale

`npm install` poi `npm run dev`. `npm test` e `npm run typecheck`.

Su create phone, Fenix persiste un seed TypeScript all'istante (anteprima e fallback) e chiede a **grok-build-0.1** un documento HTML originale. Se parse o JS non sono validi resta il seed; non è il prodotto. Le modifiche successive restano find/replace atomici sul documento già accettato.

Carico e recovery su PostgreSQL 16 reale (non PGlite), con la stessa fixture di CI:

```bash
docker run --name fenix-pg16 --rm \
  -e POSTGRES_USER=fenix_ci \
  -e POSTGRES_PASSWORD=fenix_ci_not_a_secret \
  -e POSTGRES_DB=fenix_reliability \
  -p 5432:5432 \
  --health-cmd "pg_isready -U fenix_ci -d fenix_reliability" \
  -d postgres:16
DATABASE_URL=postgres://fenix_ci:fenix_ci_not_a_secret@127.0.0.1:5432/fenix_reliability \
  npm run test:postgres-reliability
```

Dettagli: [`src/lib/projects/postgres-reliability-references.md`](src/lib/projects/postgres-reliability-references.md). La password è una fixture, non un secret di produzione.

## Worker visivo (come Emergent, in piccolo)

Netlify taglia le richieste lunghe. Il motore a 5 giri sta in `workers/visual/` e parla **grok-build-0.1**:

```bash
cd workers/visual
npm install
npx playwright install chromium
XAI_API_KEY=… npm start
```

Su Railway/Fly: stesso comando, porta `PORT`, più `VISUAL_WORKER_TOKEN` (obbligatorio in produzione: senza, il worker risponde 503) e `FENIX_ORIGIN`. Health: `GET /health` risponde `{ ok, model: "grok-build-0.1", auth }`. Poi su Netlify aggiungi `VISUAL_WORKER_URL` e lo stesso `VISUAL_WORKER_TOKEN`, solo server: il browser passa da `/__worker/*` (Netlify Function `worker-proxy`) che aggiunge il token. L'URL diretto del worker non è più usato dal client.

Senza questa variabile Fenix resta sui due sguardi nell’anteprima (html2canvas).

## Rilascio iOS / Android

Build e firma **non** girano nella Function Netlify. Il job è su Postgres (`release_jobs`, `idempotency_key` unique). Un solo workflow per piattaforma esegue build → sign → upload sullo stesso runner, persiste gli id provider e invia callback HMAC. iOS: `.p8` + Team ID con `-allowProvisioningUpdates` (P12 opzionale). Android: `ANDROID_KEYSTORE_BASE64` materializzato in temp 0600. Dettagli: [`workers/release/README.md`](workers/release/README.md). Web resta nella Function; dopo il deploy si mostra `ssl_url` Netlify.
