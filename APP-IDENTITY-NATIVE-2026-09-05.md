# App identity and Barber native direction

User screenshots showed a recovered but generic app: no header icon, serif
titles, washed-out blue-grey surfaces and generic labels. Technical recovery
did not prove premium quality.

This slice adds an editable `icon:app` sector pictogram to every composed phone
header before any model call. Barber uses original shears; perfume, fashion
and scheduling have distinct pictograms. The 44px icon tile is decorative beside
the accessible product title; it does not add a redundant focus target.

Barber defaults to native system typography, near-white separated surfaces and
a raspberry accent. Explicit serif and explicit user colors remain honored.
Other domain font defaults are not globally replaced. Fenix Studio is unchanged.
Palette history and accessibility validation remain in the token pipeline.
Agenda presentation also gets readable Italian dates/statuses and larger
original edit/archive icons; underlying status keys, storage and actions remain.

Parent fab5787 preserves existing validated metadata/palette when a polish
response omits META, fixing the observed unintended recolor at the client parser.
Three regression assertions failed before that fix and pass after it.

Focused tests: metadata continuity, four distinct sector icons, Barber native
defaults and explicit overrides. Browser D/T/M/320 proves the header icon remains
visible after all tab changes, system fonts, no horizontal overflow/pageerror;
the existing appointment state cycle also persists after remount. Typecheck and
the wider 80-test graphic/repair suite pass. Native screenshot artifacts:
`/tmp/fenix-barber-native-brand-shots/` (generated from local fixtures, not live
accounts). Full clean-clone suites and release verification are still pending.

No new paid generation, no preview deploy, and no mutation of the recovered user
project. This changes future composition; existing artifacts require a tested
revision, not a silent storage replacement. Four-tab/requested-five mismatch and
overall 10/10 quality are not claimed solved.
