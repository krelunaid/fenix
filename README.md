# Fenix

Studio visivo Kreluna. Usa il modello premium **Grok 4.6** (`grok-4.6`). Tutte le fasi AI — piano, direzione visiva, build e QA — usano lo stesso modello tramite `https://api.x.ai/v1/chat/completions`.

Prove pronte: **Fornace Grottaglie**, **Officina Catenaria**.

## Repo

[github.com/krelunaid/fenix](https://github.com/krelunaid/fenix)

## Chiave xAI

La chiave è esclusivamente server-side. Mai `VITE_XAI_API_KEY`, mai nel frontend, mai nel repository e mai nel README con il valore.

| Nome | Dove | Note |
|---|---|---|
| `XAI_API_KEY` | server | Tua, creata su [console.x.ai](https://console.x.ai) |
| `VISUAL_WORKER_URL` | server | Opzionale. Worker Playwright (3 giri telefono). Es. `https://fenix-visual.up.railway.app` |
| `VITE_AUTH_ENABLED` | build | `false` di default su Netlify: si crea senza account. Per Gmail/email metti `true` e `DATABASE_URL` |

## Configurazione Netlify

1. Apri [console.x.ai](https://console.x.ai), abilita **Credits/Billing** a pagamento e crea una nuova API key.
2. In Netlify apri **Site settings → Environment variables**.
3. Aggiungi la chiave come secret server-side con nome esatto `XAI_API_KEY`.
4. Non usare `VITE_XAI_API_KEY` e non inserire mai il valore nel repository o nel frontend.
5. Collega questo repository, configura il dominio (es. `fenix.kreluna.it`) e avvia il deploy.

Se il secret non è configurato, Fenix risponde chiaramente: `Manca XAI_API_KEY sul server`.

Le app generate (Grottaglie, Catenaria, …) si scaricano da **Pubblica** (ZIP / `index.html`) e si caricano sul sito come HTML statico.

## Locale

`npm install` poi `npm run dev`. `npm test` e `npm run typecheck`.

## Worker visivo (come Emergent, in piccolo)

Netlify taglia le richieste lunghe. Il motore a 3 giri sta in `workers/visual/`:

```bash
cd workers/visual
npm install
npx playwright install chromium
XAI_API_KEY=… npm start
```

Su Railway/Fly: stesso comando, porta `PORT`. Poi su Netlify aggiungi `VISUAL_WORKER_URL` = URL del worker, solo server.

Senza questa variabile Fenix resta sui due sguardi nell’anteprima (html2canvas).

