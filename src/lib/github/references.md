# GitHub App export e pull Fenix — evidenza ufficiale

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

## Pull verificato

`POST /api/github/import` riceve soltanto `repo` e `branch`, dopo un click esplicito.
Il server riusa l'installazione owner-bound, conia un token breve, verifica che il
repository appartenga all'installazione e legge ref → commit → tree ricorsivo →
blob. Il token non viene salvato né restituito.

Il pull accetta solo export Fenix:

- tree GitHub completo (`truncated=false`);
- un solo `fenix.json`, blob regolari mode `100644`;
- massimo 48 file, 256 KiB per file, 1,5 MB totali;
- base64 canonico decodificato come UTF-8 fatal;
- percorso, byte e checksum di ogni file devono coincidere col manifest;
- ingest comune blocca traversal, binari, estensioni non ammesse e secret.

README o altri file remoti non dichiarati non vengono importati né eseguiti. Il
client applica di nuovo i gate HTML/contratto prima di creare un nuovo studio
indipendente. Non si copiano dati, chat, job, deploy, owner o credenziali. Non è
un sync Git generico e non risolve conflitti remoti.

## CSRF / session binding

`POST /api/github` (connect) firma lo `state` HMAC (`fenix-github-state`) e imposta
il cookie `fenix_gh` HttpOnly Secure SameSite=Lax Path=/api/github/callback Max-Age=600,
HMAC `fenix-github-cookie` su ownerHash+nonce. Scopi HMAC distinti: il cookie non è
riusabile come state. SameSite=Lax è richiesto (Strict cadrebbe sul GET top-level
da github.com). Il client usa `credentials: "same-origin"`.

`GET /api/github/callback` verifica cookie contro state.ownerHash+nonce, poi
cancella sempre il cookie. Senza cookie, cookie di altro owner/nonce, scaduto o
replay: 400 prima di `saveInstallation`.

Nonce monouso: `INSERT INTO github_connect_nonces … ON CONFLICT (nonce) DO NOTHING
RETURNING nonce` (Postgres/PGlite). Su Netlify senza SQL il claim fallisce chiuso.
Blobs `fenix-github` restano per installazioni e job, non per i nonce.

GET/POST `/api/github` dichiarano `configured` solo con GitHub App **e**
`DATABASE_URL` (tabella `github_connect_nonces` raggiungibile). Le sole chiavi
App non bastano: niente cookie, niente URL `github.com/apps/.../installations/new`.

## Variabili server-only

```
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_SLUG=
DATABASE_URL=
```

Mai `VITE_*`. In produzione servono **tutte**: App ID o Client ID, PEM, slug **e**
`DATABASE_URL` con la migrazione `0003_github_connect_nonces`. Senza l'archivio
SQL atomico lo stato resta «GitHub non configurato» — nessuna connessione finta.

Setup URL (GitHub App → Callback / Setup URL): `https://fenix.kreluna.it/api/github/callback`

`FENIX_RELEASE_GITHUB_TOKEN` resta il token di dispatch nativo Fase 2, non il trasporto GitHub del prodotto.

Installazione e job idempotenti stanno nello store Netlify Blobs `fenix-github` (filesystem `.grok/github` solo in locale). Niente token in quel store.

## Limite GitHub su repo vuoto

«You are unable to create new references for empty repositories, even if the commit SHA-1 hash used exists. Empty repositories are repositories without branches.»

Fenix prova un seed `PUT /contents/README.md` e poi l'albero atomico; se GitHub rifiuta, errore chiaro. Questo può fare due commit. Non è un merge e non c'è sync VS Code.
