# Generation reliability and visual quality — 5 September 2026

Baseline: production 313cab9c93e119a7533d48c1f66711f5be5310af.
User report: 11:45 screenshot, appointment app with owner/customer access and
messages, blocked after two repairs by invalid backend JSON and generic nav.
Original provider payload and account balance were not available; reproduction
below proves code defects, not the exact origin of every screenshot finding.

## Reproduced and corrected

1. FILE parsing did not stop at HTML. A valid backend manifest immediately
   preceding `<<<HTML>>>` included the entire preview, becoming invalid JSON.
   Red test reproduced it, then passed with explicit block boundaries.
2. Edge META parsing did not stop at FILE. Normal documented FILE-first output
   lost product name, direction and palette through its JSON fallback. The
   actual Edge parser now preserves the model's validated hex colors and
   applies requested system/serif intent, including repair results.
3. Both repair transports only saw HTML and an error string, never the broken
   backend source. They now receive bounded, validated non-HTML sources;
   deterministic backend runtime files are regenerated from the manifest, not
   needlessly sent to the model. Oversize/unsafe context fails before a call.
4. PHONE_KIT used invalid `font: ... inherit` shorthand. Browser reproduction
   showed a sans-serif button inside a Georgia app. Valid longhands preserve
   the chosen family. Phone buttons use 16px/600, fields17px, tab labels12px
   (desktop13px), main action48px and14px radius; no palette/Studio rewrite.
5. Icon replacement assigned pictograms by position. It now preserves labels,
   view ids, handlers and unrelated SVG, resolving appointment/calendar/team/
   statistics/messages/settings roles from the visible function. Unlabeled
   icons remain untouched. Check-in and appointment booking have distinct glyphs.
6. Browser visual inspection exposed fallback list content inserted INSIDE
   the `data-view="list"` navigation button. Recovery now selects a content
   panel/main and respects existing product lists; it cannot append to nav,
   buttons, links, tabs or forms. Empty-state duplication and displaced icons
   are covered by real DOM tests. Phone labels wrap instead of clipping.

## Reproduce without model credits

```sh
node --test scripts/generation-boundaries.test.mjs scripts/edge-artifact-context.test.mjs
node --experimental-strip-types --test src/lib/projects/files.test.ts src/lib/ai/repair.recorded.test.ts
node --experimental-strip-types --test src/lib/projects/phone-kit-tabs-browser.test.ts
pnpm typecheck
pnpm build
pnpm test
```

Focused results before final full-suite verification: 11 transport/parser
tests, 25 file/repair tests, 47 icon/intent/QA checks passed. Browser includes
desktop/tablet/390/320, typography metrics, semantic SVG, complete labels,
keyboard/pointer navigation, five tabs, scrolling and CRUD. Screenshot outputs
`/tmp/fenix-phone-type-*.png` and `/tmp/fenix-semantic-icons-*.png`.
First full-suite attempt: scripts251pass/4historicalskip/0fail; TS/browser
528pass/1fail. The single failure asserted the old12px CTA radius in source;
updated to the intentional14px radius (not removed), then focused QA passed.
Complete verification must be rerun on the final combined commit.
These browser fixtures are functional regression tests, NOT premium design
examples or evidence of live account/role/message delivery.

## Still required for a 10/10 claim

- Actual generated apps for appointments, perfume, clothing, repositories and
  restaurant operations; distinctive, coherent screens rather than recolored
  generic lists. Do not pass generic-nav by relabeling nonfunctional buttons.
- Review semantic icon coverage on actual generated apps, beyond the corrected
  appointment roles and positional replacement regression fixtures.
- Visual comparison at desktop/tablet/mobile: hierarchy, imagery, typography,
  empty/populated/error states, accessibility and complete interaction flows.
- Live requested owner/customer isolation and messages must be proven on the
  intended runtime. An exported Node backend or local storage alone is not
  proof of working multi-user access or delivered notifications in Studio.
- No 10/10 or Emergent parity/superiority claim from static rubric scores.
  No credit purchase, no external account creation, no disabled safety gates.

Production publication is separate from local changes and requires all release
gates. This document does not assert a new production deployment.
