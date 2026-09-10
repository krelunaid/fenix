# Fenix Agent — prova di generalità su due domini

Questa prova usa due brief diversi per verificare che il nuovo agente non produca sempre la stessa app o la stessa palette:

- **Forno Vivo**, sito desktop/mobile per forno e pasticceria artigianale, con catalogo e prenotazione collegati a API e SQLite.
- **Atelier Barba**, gestionale autenticato desktop/mobile per agenda, clienti e servizi di una barberia.

## Ricevute dei job

- Forno Vivo: job finale `26e75ac1-c2c9-4d52-8013-0aba92ce413f`, modello `grok-build-0.1`, 13 test del progetto, 10 viste browser e tutti i gate allora attivi superati. Costo del secondo passaggio: `$0.1199`; il primo tentativo aveva raggiunto il budget a `$0.4303` ed è stato ripreso senza presentarlo come completo.
- Atelier Barba: la build sicura e rifinita finale è il job `fe9fc898-77d9-4fe0-994c-5d11476cbe31`, modello `grok-build-0.1`. Supera 11 test del progetto, audit server, richieste ostili, persistenza SQLite e 10 viste browser. La rifinitura del login è costata `$0.0476`; il repair di sicurezza valido precedente `4a9000be-95a3-4789-bfcc-0b9d863072e5` era costato `$0.0433`. Il tentativo `569302bb-bc56-4031-89a7-a943444de5e7` aveva invece raggiunto il budget a `$0.3797` con un solo test fallito perché `startServer` ignorava il `dataDir` isolato, quindi non viene contato come risultato valido.

Il benchmark iniziale di Atelier Barba aveva scoperto password in chiaro e non era stato accettato come prova positiva. La scoperta ha prodotto un gate indipendente che richiede `password_hash`, salt casuale, `crypto.scryptSync` e `timingSafeEqual`. La nuova esecuzione migra i record esistenti, azzera l'eventuale colonna legacy e supera il gate, il test di login e i controlli di autorizzazione. La ricevuta riproducibile è in [atelier-secure-receipt.json](evidence/generality/atelier-secure-receipt.json).

## Verifica browser esterna

Lo script `scripts/phase3-generality-browser.mjs` apre i due prodotti su tre viewport reali (390×844, 820×1180, 1440×1000), accede ad Atelier Barba con credenziali di prova passate soltanto tramite `FENIX_ATELIER_USER` e `FENIX_ATELIER_PASSWORD`, quindi registra titolo, H1, overflow e console. La ricevuta [browser-report.json](evidence/generality/browser-report.json) attesta:

- 6 viste su 6 senza overflow orizzontale;
- 6 viste su 6 con titolo e H1 specifici;
- zero errori console;
- layout realmente diverso tra sito editoriale e gestionale autenticato.

## Prove visive

- [Forno Vivo mobile](evidence/generality/forno-vivo-mobile.png)
- [Forno Vivo tablet](evidence/generality/forno-vivo-tablet.png)
- [Forno Vivo desktop](evidence/generality/forno-vivo-desktop.png)
- [Atelier Barba mobile](evidence/generality/atelier-barba-mobile.png)
- [Atelier Barba tablet](evidence/generality/atelier-barba-tablet.png)
- [Atelier Barba desktop](evidence/generality/atelier-barba-desktop.png)
- [Atelier Barba login mobile](evidence/generality/atelier-barba-login-mobile.png)
- [Atelier Barba login desktop](evidence/generality/atelier-barba-login-desktop.png)

Durante il confronto visivo Safari ha mostrato che gli sprite esterni generati non dichiaravano la grammatica stroke di Lucide: i path venivano quindi riempiti di nero. Il generatore ora inserisce direttamente in ogni `symbol` `fill="none"`, `stroke="currentColor"`, spessore 1.8 e terminali arrotondati; un test impedisce che il difetto ritorni.

## Valutazione onesta

La generalità funzionale e responsive è dimostrata, ma non equivale ancora a un 10/10 grafico. Atelier Barba è pulita, coerente e ora anche una prova full-stack valida; Forno Vivo ha una direzione editoriale pertinente, ma le immagini prodotto sono ancora simboliche e ripetitive. Questi artefatti valgono come prova di avanzamento e come baseline riproducibile, non come dichiarazione di parità complessiva con Emergent.
