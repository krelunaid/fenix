# Apple-like craft v3 — color + graphics, not another flat kit

Third visual raise on `cursor/apple-like-visual-craft-b7e4` (PR #2). Still **not main** and **not a deploy**. Andrea rejected v2 as washed/flat versus Emergent **AcquaGt**, even in the same water/field category.

Proof PNGs (deterministic `composeProduct` + `prepareSrcDoc` + Playwright, `Fenix.load` patched so seed rows stay, no live Grok):

`docs/checkpoints/2026-09-05/apple-craft-v3/`

- `01-home.png` — one rich navy shell, 2×2 KPIs, electric tank + Y axis, saturated green banner, 5 tabs
- `02-gestione.png` — large title, category/role/status pills, search, + Nuovo, tinted table
- `03-storico.png` — time pills, record cards, accent name, Firmata / Da firmare
- `04-statistiche.png` — large title, jump row, Panoramica segment, 2×3 grid, projection
- `05-icon.png` — original glossy drop + beveled ring on light paper (not terracotta, not a cloned 3D asset)
- `06-splash.png` — light paper, crisp squircle, spinner, `Apertura…`

Brief used: NordAcqua field product, `stile Apple`, **sfondo `#F3F5F8`, accento `#0A2F6B`**. User navy stays as ink/board. A vivid water accent `#0D73C4` and success `#178A45` are derived so the kit cannot collapse to olive/gray. Not Barber raspberry. Not Apple SET `#f5f5f7` + `#0071e3` / `#007AFF`.

## What moved

- Field briefs go through `enrichWaterOpsPalette` after token resolution. Dark user hexes become `--fg` / board navy; a vivid water accent is forced unless the brief already gave one.
- Campo phone apps stamp `data-fenix-campo`, use a glossy original drop mark, hide the CAMPO kicker, and ship **Home / Registra / Storico / Statistiche / Gestione**.
- Home is one navy shell (not two washed gray boards). Tank has a gradient fill, grid, and axis. Success chip is saturated green. Crude `voci sul dispositivo` is gone from the populated campo home; SYSTEM empty source still carries that string.
- Gestione / Storico / Stats keep stronger pill contrast, card shadow, and blue metric accents.

## Remaining gap vs AcquaGt (honest)

- Not Emergent parity and not 100/100. We recreated craft level, not their copyrighted drop, copy, or screens.
- Icon/splash lighting is SVG (gradients, specular, bevel), not a rendered 3D asset.
- Pills toggle visually; they do not yet filter rows.
- Tank period control is chrome, not three real data windows.
- Header mark is heavier (52px) but still a small in-app chip, not an iOS home-screen icon.
- No live Grok proof. Recovered stored projects are not rewritten.
