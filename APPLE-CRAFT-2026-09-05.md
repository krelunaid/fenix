# Apple-like craft slice — not a release

Built on `cursor/apple-like-visual-repair-b3e6` (Script-error + desk-seed + rejected raspberry). This is a quality push, not a merge to main and not a deploy to fenix.kreluna.it.

## What this slice does

Generated apps get stronger **icons, type, spacing and grouping** without turning Fenix into an iPhone skin.

- **Icons.** Original 24-grid pictograms for fiscal work (fatture, bilancio, pratiche) and shops (negozio, magazzino), plus a briefcase fallback instead of a leftover atelier mark. Barber shears stay a sector mark, not a palette. Accountant / shop / perfume / fashion / agenda marks are distinct.
- **Typography.** Native opt-in layer now publishes a HIG-like type ramp (`--fenix-type-large-title` 34 → caption 12) and tabular figures. Composed seeds expose `--t-callout`, `--t-subhead`, `--space:8px`. Locked computed sizes stay: 30/34 title, 17px fields, 28px selected-nav icons, 44–48px targets.
- **Spacing / grouping.** Agenda and pocket lists use inset hairlines. Desk KPIs share one grouped surface. Dashboard fallback kit keeps **header rail + table**, not a tabbar. Safer-area padding on native tabs.
- **Any domain.** Barber is only a fixture. A commercialisti gestionale stays `ops-desk`. A shop brief does not inherit raspberry or shears. Colors still come from the activity recipe + explicit hex.

## What this slice does not do

- Does not merge to main or deploy.
- Does not force `stile Apple` / iPhone tabbar onto dashboards. `wantsNativeAppStyle` remains app-only and keyword-opt-in.
- Does not write `--accent` / `--bg` or `#b51246` from the native layer.
- Does not change Fenix Studio chrome.
- Does not claim 100/100, Emergent parity, or that live Grok output already looks like this. Seeds and kits improved; stored recovered projects are not silently rewritten.
- Does not spend model credits. Proof is composition + unit gates, not a paid generation.

## Verify

```sh
node --experimental-strip-types --test \
  src/lib/projects/craft-icons.test.ts \
  src/lib/projects/graphic-intent.test.ts \
  src/lib/projects/layout-grammar.test.ts \
  src/lib/ai/compose-product.test.ts \
  src/lib/projects/validate-html.test.ts
pnpm typecheck
```

Script-error remains opaque (`isOpaquePreviewError("Script error.")`). Dashboard creates still send empty HTML (no phone seed).

Andrea must approve visuals before any main merge.
