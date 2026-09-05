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

## Next protocol slice: runtime-independent atomic edits

`workers/visual/composed-protocol.mjs` extracts the existing atomic validator,
palette validation and system instruction without Node-only dependencies.
Its Web Crypto entrypoint computes SHA-256 from the actual original HTML;
the Node worker retains its synchronous API through a thin crypto wrapper.
Parity tests compare Unicode/literal replacement bytes and rejection of stale
hashes, malformed plans, ambiguous/overlapping targets and oversized sources.
This is preparation for Edge parity, NOT a transport switch or a premium result.
The Edge route and controller still need contract-aware integration: do not
route backend/auth requests to an HTML-only composed protocol and lose files.
Complete release verification must cover the eventual integrated commit.

Foundation verification: 13/13 targeted tests passed, including actual worker
requests against a mocked provider and Node/Web Crypto parity. Typecheck and
build passed on this working tree; its build manifest still identifies the
parent c1b2f81, so it is NOT an exact-commit release artifact. No Edge/controller
wiring, full-suite rerun, GitHub push or deployment is claimed for this slice.
Logs: /tmp/fenix-composed-protocol-worker.log and
/tmp/fenix-composed-webcrypto-build.log. No model/network generation was used.

## Edge integration and startup regression discovered by the real gate

The Edge handler now uses the shared atomic protocol for composed initial phone
apps whose contract requires only index.html. It preserves the original head,
palette and seed; rejects stale/unsafe plans, truncated streams and missing stop
signals; and never interprets rejected JSON as a full-document fallback. The
existing product gate remains active, with at most two atomic repair attempts.
The controller does not resubmit an uncertain atomic Edge job to the worker.
Full-stack/login/file-tree requests retain their full-project Edge path. This
does NOT solve the separate worker/iOS backend contract or prove live auth.

The actual Edge gate test exposed another pre-existing startup failure:
ensureDomainImagery matched HTML inside JS strings and injected unescaped SVG,
turning a valid composed Agenda into `Invalid or unexpected token`. Composed
products now retain their own dynamic imagery; legacy markup enhancement
protects script/style/comment contents byte-for-byte. Five real composition
fixtures remain syntactically valid through the adapter, and legacy real hero
markup still receives imagery. No syntax or quality gate was disabled.

Focused verification: 52/52 tests passed, including actual Edge handler/provider
mocks, actual worker requests, metadata/files/repair regressions and five-domain
composition checks. Typecheck/build passed before the final diagnostic wording
change; complete clean-clone suites, browser verification and exact-commit
release gates remain required. This is local work, not a 10/10 or deploy claim.

## Agenda naming and semantic actions

Visual inspection of the previous worker screenshot found `Agenda appuntamenti
e prenot`: a descriptive brief was cut mid-word at 28 characters. Descriptive
long agenda requests now use `Agenda`; explicit names before a colon or quoted
after a naming instruction are retained, including names longer than28.
Long unbroken names wrap without overflowing instead of being silently cut.
The appointment status cycle is unchanged, but each action now describes its
effect: Conferma, Inizia, Concludi, Riapri. Initial and JS-rendered controls use
the same labels and accessible names. No palette, identity or Studio changes.

37/37 focused composition/Edge/calendar regression tests passed before the final
long-name wrapping addition; its focused naming/browser tests2/2 and typecheck
then passed. Browser checks cover1280/768/390/320, 44px targets, complete labels,
four status transitions and persistence across remount, long explicit brands,
and no page errors. Screenshots: /tmp/fenix-agenda-labels-shots/{D,T,M,S}-initial.png
and -after-cycle.png, reproducible by the new test in agenda-runtime-browser.
Inspected desktop390/320 images: names and actions are clearer; repeated Sala
metadata and generic sample contents remain, so this is not a10/10 claim.
Full clean-clone regression and release verification for this slice are pending.
