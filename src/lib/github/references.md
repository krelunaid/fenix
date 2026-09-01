# GitHub App export — evidenza ufficiale

Fenix esporta l'albero POSIX su un repository **esistente** con una GitHub App.
Niente token nel browser, niente OAuth utente, niente credenziali inventate.
Emergent resta un benchmark, non un modello da copiare.

## Documentazione GitHub (2026)

- JWT RS256, `iat` −60s, `exp` ≤ 10 min; `iss` = App ID o Client ID:
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
- Installation access token (breve, mai persistito, mai nel client):
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
- Install URL `https://github.com/apps/{slug}/installations/new?state=`:
  https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party
- Git Data API blob → tree → commit:
  https://docs.github.com/en/rest/git/blobs
  https://docs.github.com/en/rest/git/trees
  https://docs.github.com/en/rest/git/commits
- Aggiornamento ref, `force` default `false` (fast-forward; 409 se il branch è mosso):
  https://docs.github.com/en/rest/git/refs
  «Leaving this out or setting it to false will make sure you're not overwriting work.»
- Header `X-GitHub-Api-Version: 2026-03-10`
- Permessi minimi: **Contents** read/write, **Metadata** read.

## Variabili server-only

```
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_SLUG=
```

Mai `VITE_*`. Se mancano, lo stato è «GitHub non configurato» — nessuna connessione finta.

Setup URL (GitHub App → Callback / Setup URL): `https://fenix.kreluna.it/api/github/callback`

`FENIX_RELEASE_GITHUB_TOKEN` resta il token di dispatch nativo Fase 2, non l'export prodotto.

Installazione e job idempotenti stanno nello store Netlify Blobs `fenix-github` (filesystem `.grok/github` solo in locale). Niente token in quel store.

## Limite GitHub su repo vuoto

«You are unable to create new references for empty repositories, even if the commit SHA-1 hash used exists. Empty repositories are repositories without branches.»

Fenix prova un seed `PUT /contents/README.md` e poi l'albero atomico; se GitHub rifiuta, errore chiaro. Questo può fare due commit. Non è un merge e non c'è pull VS Code.
