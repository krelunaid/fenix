# Barber generation failure — scoped investigation

Production incident: user screenshot 2026-09-05 15:47 Europe/Rome, project
`ae6207f8-0b28-416c-9c4c-0028c47f3768`. Safari loaded production asset
`index-BX0-3zJC.js` (release `4891bfbeae091c09abda6e3f75a1a036cc74336f`).
The stored log reports `Script 1: Invalid or unexpected token` after two repairs.
No HTML or stable snapshot was stored for this failed creation; the four-credit
charge and refund are present. This is not proof of a stale browser or a worker outage.

## Reproduced weaknesses

- The exact prompt `mi crei un app da parrucchieri stile Barber shop`, with the
  phone format prefix, selected generic `phone-seed`/`paper`, not an appointment
  composition. That original seed and its prepared srcdoc compile locally;
  classification alone does not prove the cause of the reported SyntaxError.
- JavaScript compilation errors from `new Function` have no dependable source
  location. Repairs received a generic error, making precise repairs harder.

## Changes

- Recognize Italian hairdresser/barber and English Barber shop/hair salon terms
  as the booking family, reusing the existing appointment composition.
- On failed compilation only, use pinned Acorn 8.18.0 to locate the invalid
  JavaScript in the original script (including leading newlines). Never execute
  the source. Preserve the original engine error; expose coordinates, not source
  excerpts. The normal syntax/contract gate and two-repair maximum remain intact.
- Actual Edge handler test uses the exact reported prompt with a mocked provider:
  inject an unterminated string, assert the repair receives script/line/column
  and the SHA of the damaged artifact, return a hash-bound correction, and
  require valid HTML, preserved head/palette, and exactly two provider calls.
- Separate negative tests retain rejection of unrepaired syntax, invalid hashes,
  full rewrites and incomplete responses. No validity gate was relaxed.

## Evidence and limits

Focused tests: 33/33 pass (`/tmp/fenix-barber-focused.log`). A first draft of the
tests incorrectly assumed a static `data-view="new"`/`Prenota` label and one
parser column; corrected against the existing agenda contract and actual token
position, without changing production checks. Dependency resolver peer churn
was removed; lockfile change is only the three-line direct Acorn importer.

These are local mocked-provider results, NOT a reproduced copy of the missing
production model output, a production retry, or proof that all generation
failures are fixed. No paid generation, credit purchase, push or deploy has been
performed for this slice yet. Existing uncommitted icon/date/spacing polish is
separate and must not be included accidentally. Full clean-clone gates and a
real creation still remain before declaring this incident resolved.
