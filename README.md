# Fenix

Studio visivo indipendente. Descrivi un’app, un sito o un programma: Grok 4.5 lo costruisce, gira in anteprima, si itera in chat.

Non è collegato a Helix. Prodotto a sé.

## Repo

[github.com/krelunaid/fenix](https://github.com/krelunaid/fenix)

## Chiave

Server-only. Non `VITE_`.

| Nome | Dove | Note |
|---|---|---|
| `XAI_API_KEY` | server | Tua, da [console.x.ai](https://console.x.ai) |
| `VITE_AUTH_ENABLED` | build | `false` |

## Online (Netlify)

1. Crea la chiave su console.x.ai
2. Nuovo sito Netlify da questo repo
3. Secret: `XAI_API_KEY` = la tua chiave
4. Dominio (es. fenix.tuodominio.it)
5. Deploy. Brief → Build.

## Locale

`npm install` poi `npm run dev`. `npm test` e `npm run typecheck` per i test.
