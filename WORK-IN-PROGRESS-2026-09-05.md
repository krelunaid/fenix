# Recovery checkpoint — not a release

Saved at the user's request on 2026-09-05. This branch is a backup plus a visual-policy repair. It is not an approved product look and must not be deployed as-is.

## Latest user direction

Generated apps should use an Apple/iPhone-like visual structure, typography, spacing, icons and interactions. Colors must follow the activity and explicit request, not a universal palette or arbitrary accent. Preserve the Fenix Studio interface and identity.

The local Barber raspberry palette and boxed layout in 1366c0b were rejected. That commit stays recoverable on this history. The rejected house accent (`#b51246`) is no longer injected by token policy.

## What was wrong (root cause)

Codex kept missing Apple-like quality because several layers were fused into one "Barber look":

1. **Rejected palette policy.** `tokensFromBrief` overwrote the booking recipe with a hardcoded raspberry sheet whenever `isBarberBrief` matched. A shop name became a house accent.
2. **Native style coupled to domain.** `graphicIntentFromBrief` / `wantsNativeAppStyle` forced system type and the native layer for every barber brief, including "stile Barber shop" (a shop type, not `stile iPhone`).
3. **Seed chrome painted accent as decoration.** Agenda slots were separate bordered cards with an inset accent bar; times, the header mark and filled CTAs all used `--accent`. Once the palette was raspberry, the UI became the rejected boxed draft.
4. **Polish cannot rescue this.** The visual-style contract can change size/weight/spacing on a finite selector list. It cannot replace icons, font family or palette, and it has no critic for "boxed / house accent". Repair only retries invalid CSS.
5. **Generic recovered project is a stored artifact.** The older four-tab Barber screenshots are a previous generation, not proof that the new seed is approved.

## What this repair changed

- Colors stay on the domain recipe + `applyUserColors`. Barber no longer injects `#b51246`.
- Native structure is opt-in (`stile Apple` / `stile iPhone` / `interfaccia iOS` / `iPhone-like`) and never writes palette variables.
- Explicit serif and explicit hex colors still win.
- Agenda seed uses a grouped list (hairline rows, times in foreground, no inset accent bar). Header mark is a surface tile, not an accent square.
- Sector pictograms, Italian agenda dates/statuses and edit/archive glyphs stay. Nav strokes are slightly heavier.
- Fenix Studio is untouched. No main push, no Netlify deploy, no paid generation.

## Saved source

- fab5787: retain existing palette and project identity when refinement returns missing or invalid metadata; four regression cases.
- 1366c0b: default editable sector app icons, native Barber draft, agenda dates/statuses/action icons. Visual draft rejected; useful technical changes reviewed separately.
- A second backup branch, backup/fenix-2026-09-05-agenda-wip, preserves the earlier agenda working copy and its 20 image/JSON artifacts without overwriting this newer draft. Do not merge or mix that branch here.

## Verification boundaries

Focused suites on this repair: graphic-intent (including shop-name vs palette), compose-product Barber identity, agenda-runtime Barber brand shots, native-app-style contract, plus typecheck. These are not two complete clean-clone release suites. Do not claim 10/10, parity with Emergent, or production availability of this draft.

Production was verified unchanged at 9beca8cc25973a6e8955449df8ba913fdad39743 during the original backup, Netlify deploy 6a9c2deada0f7100085eace5. Only main is enabled for Netlify branch builds. No main push or deploy is part of this work.

## Remaining work

Validate real generated results (not only fixtures) before claiming completion. The recovered Barber project still has older generated visuals and four generic runtime tabs; this slice changes future composition, not silent storage replacement. Five-tab brief fidelity, live Grok quality and a full clean-clone suite are still open. Andrea must approve visuals before any merge to main.

No paid generations were started for this repair.
