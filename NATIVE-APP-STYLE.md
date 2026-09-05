# Native-inspired generated app direction

Local implementation, not a release or a premium/competitor score.

Explicit app briefs containing `stile Apple`, `stile iPhone`, `interfaccia iOS`
or `iPhone-like` select system typography and an original, head-only style layer.
The layer is used by composition and reapplied by graphic-intent enforcement in
the response parser when the composed artifact contract remains present.
It does not change Fenix Studio, brand identity, data, runtime scripts, routing,
icon paths, or the selected project palette. Sites/dashboards, denied requests,
Apple Pay/reseller mentions and font-only briefs do not activate this layer.
An explicit later serif request remains authoritative for typography.

The direction includes an upright 30–34px headline, 17px form text, consistent
14px control radii, 18px surfaces, 44–48px tap targets, 28px original nav icons
with stronger selected strokes, visible focus and reduced-motion handling.
Selected nav text uses foreground-on-surface rather than accent-on-tinted-surface:
browser testing exposed insufficient contrast in one of the adaptive palettes.
Colors and domain imagery remain project-specific; this is not an Apple skin
or a promise that arbitrary model-generated HTML has this quality.

## Reproduce

```sh
node --experimental-strip-types --test src/lib/projects/graphic-intent.test.ts
node --experimental-strip-types --test --test-name-pattern='native app style' src/lib/ai/intent-preservation-browser.test.ts
pnpm typecheck
```

The browser test composes agenda, fragrance, clothing and personal-list apps,
then runs actual sandbox runtime navigation at 1280, 768, 390 and 320px.
It checks computed typography, visible icon/tap sizes, nav text AA contrast,
overflow, form sizes/focus, reduced motion and console errors. Personal-list CRUD
and reload use the declared local persistence mock; no provider or credits.
Screenshots go to `FENIX_NATIVE_SHOTS` or `/tmp/fenix-native-app-shots`.
`before` means the same system-font composition without the native style layer,
not a historical production screenshot. `after` and `form` show rendered output.

## Remaining release work

Full regression/build checks on the final source revision, integration against
Grok's latest source and live quality checks remain required. The initial worker
can still replace composed HTML; this slice does not solve that contract or
silently substitute styling for requested functionality. It is opt-in in the
app brief, not a new global preference and does not retrofit saved projects.
Deploy is deferred at the user's request. No production parity claim.
