# Fenix Agent — prova verticale AcquaTrack

Brief usato:

> Crea un’app completa per registrare l’acqua utilizzata dai dipendenti. Servono login sicuro, ruoli amministratore e dipendente, luoghi di lavoro, registrazioni con litri, data, turno e nota, storico filtrabile e statistiche. L’amministratore vede tutto; ogni dipendente vede e gestisce solo le proprie registrazioni. I dati devono essere condivisi tra dispositivi e restare disponibili dopo logout e ricaricamento. Usa un’interfaccia premium stile Apple, icone professionali coerenti e colori pertinenti alla gestione dell’acqua.

## Ricevuta verificabile

- Job finale: `fa05be88-f78a-4904-9db6-f8ca68368692`.
- Motore: `grok-build-0.1`, eseguito dal worker Fenix sulla VPS isolata.
- Gate agente: tutti superati — manifest, dimensioni, file obbligatori, sintassi, placeholder, UI statica, SQL parametrizzato, UI kit, avvio, health, sei pagine, 12 route API, richieste ostili, persistenza, 34 test del progetto e browser.
- Flusso Playwright esterno: login amministratore, crea, persistenza dopo reload, modifica, elimina; login dipendente e assenza della sezione amministrativa; console pulita a 390×844 e 1440×1000.
- Ricevuta macchina: [browser-flow.json](evidence/acquatrack/browser-flow.json).
- Riproduzione browser: avvia il progetto AcquaTrack su `127.0.0.1:4317`, quindi esegui `node scripts/phase3-acquatrack-browser.mjs` dalla radice di Fenix.

## Prove visive

- [Dashboard mobile](evidence/acquatrack/dashboard-mobile-v2.png)
- [Dashboard desktop](evidence/acquatrack/dashboard-desktop-v2.png)
- [CRUD mobile](evidence/acquatrack/records-mobile.png)

Il confronto ha inoltre trovato e corretto un override che nascondeva la sidebar desktop. Il gate `ui:kit` ora rifiuta le ridefinizioni dei componenti strutturali e il gate statico segnala il `return` illegale al livello principale di un modulo ES.

Questa prova dimostra la fetta full-stack, non ancora una parità complessiva con Emergent. La qualità visiva osservata è 8,5/10; servono benchmark su altri domini e layout prima di assegnare 10/10.
