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
| `VITE_AUTH_ENABLED` | build | `false` |

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
