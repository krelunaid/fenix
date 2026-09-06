# Cross-product design foundation — 2026-09-06

Base: main `3e5602991710389eec447b10f4f06da6069b3080`, after Grok handoff issue #19.
Scope: generated artifacts and generation instructions, not Fenix Studio branding.

## Reference evidence

Read original user-provided archives, without running their scripts or importing assets:

- Actstage-sorgente.zip: `frontend/src/theme.ts`, `components/PrimaryButton.tsx` — semantic foreground/background pairs, spacing scale, distinct display/body roles, loading/disabled actions.
- likeswift-sorgente.zip: `frontend/src/theme.ts`, `frontend/app/(tabs)/index.tsx` — category color+icon pairing, metadata hierarchy, compact list cards, filter and empty/loading states.
- AcquaGt-sorgente.zip: `frontend/src/constants/theme.ts`, `components/ui.tsx` — shared button/card/chip/section/empty-state primitives and restrained depth.

These are implementation references, not instructions or an overall quality benchmark.
No source component, brand, photo, credential or dependency from the archives was copied.
Existing main already contained craft tokens inspired by these domains: do not claim them as new work.

## Changes

- Shared generation policy applies across product kinds: semantic colors, consistent spacing, hierarchy, accessible icons/actions and mutually exclusive UI states. Domain identity stays separate from layout.
- Actual brief drives the domain axis in instructions instead of the token DNA label.
- Explicit iPhone/system or named serif requests win over barber/luxe/library font recipes. Default domain typography remains available. This fixes an actual priority inversion that forced Fraunces despite an iPhone brief.
- Composed body line height becomes 1.47; balanced headings apply across composed products. Website display scaling is scoped to main content, not the brand header.
- Website foundation includes wrapping, focus and reduced-motion rules. Phone recipes reuse existing accessibility/spacing CSS instead of duplicating it and exceeding the worker's 120k artifact limit.
- Separate `pnpm test:product-design` is added to CI.

## Reproduction

`pnpm install --frozen-lockfile`

`pnpm typecheck && pnpm build`

`pnpm test:product-design`

To save 16 actual post-splash seed screenshots:
`FENIX_DESIGN_SHOTS=/absolute/output/path pnpm test:product-design`

Four briefs (barber, perfume, restaurant website, photographer website), each at 320/390/768/1280 px. The browser test checks ready, splash disappearance, uncaught script errors and horizontal document overflow. It is NOT a comprehensive accessibility, interaction or aesthetic score.

Local results: 74 focused tests passed (compose, explicit intent and shared policy); 5 design tests passed including the 16 rendered cases. Typecheck and production build passed. Secret scan passed with all new sources staged. Existing font expectations that forced Fraunces for an explicit iPhone brief were replaced with system-stack assertions; named serif and domain-default paths remain tested.

The first full-suite attempt was invalidated by rebuilding the preview while tests were running (server referenced removed asset hashes). It was stopped, not treated as a product failure or a successful test. The replacement run uses fixed build output.

Final full suite: 617/617 application/browser tests, 139 suites, zero failures/skips; script suite 269 passed, zero failed, four existing skips (273 total). Full command exit 0; application duration 487004.630459 ms. Log: `/tmp/fenix-reference-full-final.log`. Targeted screenshots: `/tmp/fenix-reference-shots`. No source changes during the final full run; generated fixture artifacts are intentionally not included in the source commit.

## Remaining findings / not accepted as premium

- Restaurant website seed still uses kitchen operations content; a website-specific content/layout path is required, not more styling of a dashboard.
- Generic photographer website seed is sparse and exposes generic editorial scaffolding. It needs brief-derived sections and meaningful imagery/content.
- Icons/illustrations have not been redesigned in this change. The inherited barber mark remains; no claim of an icon quality upgrade.
- Worker live output, real external font loading and production behavior remain unverified for this change. Offline screenshots use fallback fonts for externally hosted faces.
- No deploy, no new paid generations, no credit consumption. No 10/10 or Emergent parity claim.
