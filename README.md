# Fenix

Studio visivo Kreluna. Usa **Grok Build** (`grok-build-0.1`), non un modello chat generico. Descrivi un’app: agente visivo, poi codice.

Prove pronte: **Fornace Grottaglie**, **Officina Catenaria**.

## Repo

[github.com/krelunaid/fenix](https://github.com/krelunaid/fenix)

## Chiave

Solo server. Mai `VITE_XAI_API_KEY`, mai nel frontend.

| Nome | Dove | Note |
|---|---|---|
| `XAI_API_KEY` | server | Tua, da [console.x.ai](https://console.x.ai) |
| `VITE_AUTH_ENABLED` | build | `false` |

## Online (Netlify)

1. Chiave su console.x.ai  
2. Nuovo sito Netlify da questo repo  
3. Secret: `XAI_API_KEY`  
4. Dominio (es. fenix.kreluna.it)  
5. Deploy. Brief → Crea.

Le app generate (Grottaglie, Catenaria, …) si scaricano da **Pubblica** (ZIP / `index.html`) e si caricano sul sito come HTML statico.

## Locale

`npm install` poi `npm run dev`. `npm test` e `npm run typecheck`.
