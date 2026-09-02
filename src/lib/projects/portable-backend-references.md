# Backend portabile full-stack

Runtime deterministico per i brief che chiedono esplicitamente un backend.

- Manifest schema: `backend/fenix.backend.json`. Fenix materializza server, package, schema, migrazioni e `fenix.deploy.json`. Il codice `server.mjs` del modello viene scartato.
- Deploy accoppiato: `npm start` dalla radice serve `index.html` e `/api` sulla stessa origine. `GET /health` espone `{ ok, service, version, schema, origin: "same" }`.
- Migrazioni in `backend/migrations/NNNN_name.sql`: ordinate, checksum, transazione unica, solo avanti. Una migrazione rotta non parte il server e non lascia uno schema a metà.
- Auth invariata: scrypt, cookie HttpOnly SameSite=Strict, isolamento per `owner_id`, Bearer opzionale, corpo 256 KB, If-Match CAS.
- Nessun segreto nel tree. Non è un database distribuito e non dichiara parità Emergent.
