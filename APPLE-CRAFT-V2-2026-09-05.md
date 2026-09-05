# Apple-like craft v2 — closer to AcquaGt, not parity

Second visual raise on `cursor/apple-like-visual-craft-b7e4` (PR #2). Still **not main** and **not a deploy**. Andrea rejected v1 seeds as a generic kit and pointed at Emergent **AcquaGt** as the quality bar.

Proof PNGs (deterministic `composeProduct` + `prepareSrcDoc` + Playwright, no live Grok):

`docs/checkpoints/2026-09-05/apple-craft-v2/`

- `01-home.png` — greeting stack, dark KPI 2×2, 100% tank, success chip
- `02-gestione.png` — search, pills, + Nuovo, tinted table, status dots, icon actions
- `03-storico.png` — time pills, record cards, drop marker, Firmata badges
- `04-statistiche.png` — large title, jump row, segmented control, 2×3 grid, projection
- `05-icon.png` — domain squircle + progress ring (SVG depth, not a 3D render)
- `06-splash.png` — light paper, mark, spinner, voice.load (`Carico…`)

Brief used: NordAcqua field product, `stile Apple`, **sfondo `#F3F5F8`, accento `#0A2F6B`**. Colors are explicit domain hex, not a Barber house palette and not Apple SET `#f5f5f7` + `#0071e3`.

## What moved

Composition now builds **product panes**, not only type tokens: home board/tank, gestione table, storico cards, stats grid, plus a squircle mark and splash. Field briefs (consegne / dipendenti / storico+statistiche) get Home / Gestione / Storico / Statistiche. Semantic SYSTEM sheets still boot as **Niente in lista** with no `Ciao`. Commercialisti stay `ops-desk`. No iPhone tabbar on dashboards. Fenix Studio unchanged.

## Remaining gap vs AcquaGt (honest)

- Not Emergent parity and not 100/100.
- Icon/splash are original SVG (gradient + ring), not a lit 3D water-drop asset.
- Home still carries a leftover count line (`voci sul dispositivo`) under the tank.
- In-app header mark is smaller/fainter than a finished iOS app icon.
- Stats “In evidenza” can sit below the fold on a 390×844 frame.
- Pills are chrome, not wired filters. Tank is a filled well, not a gauged cylinder with a Y axis.
- Four tabs, not AcquaGt’s five. No live Grok proof. Recovered stored projects are not rewritten.
