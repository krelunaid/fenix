# Bounded composed-app refinement (local, unreleased)

Automatic `/polish` for composed apps can refine static chrome through a strict
JSON style plan instead of incompatible inert-template patches. Explicit edits,
atomic icon changes, sites and dashboards retain their existing routes. This is
not a Studio redesign and does not fix initial `/build` full-document rewriting.

The contract permits bounded type size/weight/spacing, padding, gap, radius and
subtle shadow on a finite selector list. It cannot replace HTML, runtime scripts,
copy, icons, font family or the chosen palette. Only its own head style layer is
added/replaced; body and scripts remain byte-identical. Incomplete provider
responses, unsafe declarations, absent targets and ineffective plans fail rather
than report a successful edit. There is one provider request, using
`grok-build-0.1`, without an image/icon/rewrite fallback or additional repairs.

The effect gate uses a new browser context with app JavaScript disabled, service
workers blocked and all network requests aborted. It checks visible computed
changes at 390, 768 and 1280 pixels, including ancestor visibility. It deliberately
rejects targets available only after script execution. Browser unavailability
also fails closed. The separate app-runtime tests execute the unchanged app in
the existing sandbox harness with mock persistence.

## Reproduction

    node --test scripts/visual-style.test.mjs scripts/visual-style-effect.test.mjs scripts/visual-style-worker.test.mjs scripts/visual-worker-outcome.test.mjs
    node --experimental-strip-types --test --test-name-pattern='structured visual plan survives' src/lib/ai/intent-preservation-browser.test.ts

The latter covers five composition briefs (agenda, perfume, clothing, repository,
restaurant), desktop/tablet/mobile, before/after computed style and screenshots,
all navigation tabs, unchanged fonts/colors/scripts and browser errors. CRUD is
checked only for the phone-seed grammar, not every domain. Output defaults to
`/tmp/fenix-visual-style-shots`; `FENIX_STYLE_SHOTS` selects an artifact directory.

All plans/provider responses here are authored or mocked. No live generation or
credits are used. Enlarged test headings demonstrate an effect, not an aesthetic
recommendation. Clothing's generic chrome, richer domain composition, palette and
font intent, initial build integration, dynamic-only refinement and live quality
benchmarking remain open. A visible change is not proof of premium design,
accessibility, parity with Emergent or release readiness. Full clean-clone gates
and integration with Grok's latest source are still required before release.
