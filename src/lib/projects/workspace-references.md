# Workspace progetto

Studio condiviso per l’albero del progetto, distinto dai link **Collabora sui dati** delle app pubblicate.

- Identità: hash SHA-256 di `x-fenix-owner`. Il ruolo non si legge dal browser.
- Invito: token 64 hex mostrato una volta, persistito solo come hash, consumato al join.
- Viewer: GET albero. PUT/invite/revoca → 403.
- Editor/owner: PUT file con `If-Match` (versione o hash). Conflitto → 409 fail-closed. Senza precondizione → 428.
- Presenza: heartbeat per `sessionId`, TTL 45s, senza hash identità in chiaro.
- Audit: max 64 eventi, testo redatto, niente token/segreti.
- Produzione: serve `DATABASE_URL` + migrazione `0006_project_workspaces`. Altrimenti 503. Non acquistare database da qui.

Niente token raw nel client o nel JSON di progetto. Niente parità Emergent.
