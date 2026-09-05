/** Head-only native structure. Never writes palette variables or shop accents. */
const STYLE = `<style data-fenix-native-style="v1">
html[data-grammar]{--fenix-type-large-title:34px;--fenix-type-title:28px;--fenix-type-title2:22px;--fenix-type-title3:20px;--fenix-type-headline:17px;--fenix-type-body:17px;--fenix-type-callout:16px;--fenix-type-subhead:15px;--fenix-type-footnote:13px;--fenix-type-caption:12px;--fenix-space:8px}
html[data-grammar] body{font-size:17px;line-height:1.47;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
html[data-grammar] header{padding:24px 20px 16px;align-items:center;gap:16px;background:var(--bg);border-bottom:0;flex-wrap:wrap}
html[data-grammar] header>div{min-width:0;flex:1 1 180px}
html[data-grammar] .brand{font-size:32px;font-weight:700;font-style:normal;line-height:1.12;letter-spacing:-.03em;text-transform:none;overflow-wrap:anywhere}
html[data-grammar] header .kicker{font-size:12px;font-weight:600;letter-spacing:.04em;margin-bottom:5px;text-transform:none}
html[data-grammar] header .place{font-size:13px;line-height:1.4;font-weight:500}
html[data-grammar] .app-mark{width:44px;height:44px;background:var(--elevated);color:var(--fg);border:1px solid var(--line);box-shadow:none;border-radius:12px}
html[data-grammar] .app-mark svg{width:26px;height:26px;stroke-width:2}
html[data-grammar] main{padding-left:20px;padding-right:20px;padding-top:8px;padding-bottom:28px}
html[data-grammar] :is(.time,.slot .time,.kpi b,.home-count,td:last-child,.week-day b){font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
html[data-grammar] :is(.card,.fragrance,.ticket,.room,.look,.kpi,.measure,.home-hero,.persona-privacy,.wipe-box){border-radius:18px;box-shadow:none}
html[data-grammar] :is(.card,.ticket,.room,.kpi,.measure){border-color:color-mix(in srgb,var(--line) 70%,var(--surface))}
html[data-grammar] :is(.card,.fragrance,.ticket,.room,.look) h2{font-size:19px;line-height:1.25;font-weight:650;letter-spacing:-.02em}
html[data-grammar] :is(.home-first,.list-head,.persona-pane)>h2{font-size:24px;line-height:1.2;letter-spacing:-.025em}
html[data-grammar] :is(.home-aside,.persona-facts) .card h2{font-size:17px}
html[data-grammar] .notes{font-size:15px;line-height:1.5}
html[data-grammar] .btn{min-height:48px;min-width:44px;padding:12px 18px;border-radius:14px;font-size:16px;font-weight:600;line-height:1.25;letter-spacing:-.01em;touch-action:manipulation}
html[data-grammar] .btn.ghost{background:var(--surface);color:var(--fg);border:1px solid var(--line)}
html[data-grammar] .btn.sm{min-height:44px;padding:10px 12px;font-size:14px}
html[data-grammar] :is(input,select,textarea){min-height:48px;padding:12px 14px;border-radius:12px;font-size:17px;line-height:1.4;background:var(--surface)}
html[data-grammar] label{font-size:14px;font-weight:600;line-height:1.4;letter-spacing:0;margin-top:18px;margin-bottom:7px}
html[data-grammar] nav.tabs{background:var(--surface);border-top:1px solid var(--line);box-shadow:none;padding-bottom:env(safe-area-inset-bottom)}
html[data-grammar] nav.tabs button{min-height:48px;gap:5px;font-size:12px;font-weight:600;line-height:1.2;padding:6px 4px}
html[data-grammar] nav.tabs button.on{background:transparent;color:var(--accent);border-radius:12px;box-shadow:none}
html[data-grammar] .fx-large{font-size:var(--fenix-type-large-title);font-weight:700;letter-spacing:-.035em}
html[data-grammar] .fx-sub{font-size:var(--fenix-type-subhead);color:var(--muted)}
html[data-grammar] :is(.fx-board,.fx-tank,.fx-card,.fx-record,.fx-table-wrap){border-radius:22px}
html[data-grammar] .fx-pill.on,.fx-filter.on,.fx-nuovo{box-shadow:none}
html[data-grammar] .app-mark{width:44px;height:44px;padding:0;border:0;border-radius:14px;overflow:hidden}
html[data-grammar] .app-mark svg{width:44px;height:44px}
html[data-grammar] :is(nav.tabs,nav.rail) svg{width:28px;height:28px;flex:0 0 28px;stroke-width:1.8}
html[data-grammar] :is(nav.tabs,nav.rail) button.on svg{stroke-width:2.2}
html[data-grammar] nav.rail button{min-height:44px;border-radius:12px;line-height:1.3}
html[data-grammar] .week-day{border-radius:12px;min-height:64px}
html[data-grammar="agenda"] .day-head{padding:2px 0 18px}
html[data-grammar="agenda"] .day-head .kicker{font-size:14px;letter-spacing:0;margin-bottom:5px;text-transform:none}
html[data-grammar="agenda"] .day-head .kicker::first-letter{text-transform:uppercase}
html[data-grammar="agenda"] .day-head h2{font-size:24px;line-height:1.2;letter-spacing:-.025em}
html[data-grammar="agenda"] .day-rail{gap:0;background:var(--surface);border:1px solid color-mix(in srgb,var(--line) 75%,transparent);border-radius:16px;overflow:hidden}
html[data-grammar="agenda"] .slot{border:0;border-bottom:0;border-radius:0;box-shadow:none;background:transparent;margin:0;position:relative}
html[data-grammar="agenda"] .slot:not(:last-child)::after{content:"";position:absolute;left:72px;right:16px;bottom:0;height:1px;background:color-mix(in srgb,var(--line) 75%,transparent);pointer-events:none}
html[data-grammar="agenda"] .slot:last-child{border-bottom:0}
html[data-grammar="agenda"] .slot[data-state="on"]{border-color:color-mix(in srgb,var(--line) 75%,transparent);background:transparent}
html[data-grammar="agenda"] .slot .time{color:var(--fg);font-size:15px;font-weight:650;font-variant-numeric:tabular-nums}
html[data-grammar="agenda"] .slot:hover,html[data-grammar="agenda"] .slot:active{transform:none;filter:none;box-shadow:none;border-color:color-mix(in srgb,var(--line) 75%,transparent)}
html[data-grammar="agenda"] .slot-body{min-width:0}
html[data-grammar="agenda"] .slot-detail{margin:4px 0 9px;overflow-wrap:anywhere}
html[data-grammar="agenda"] .slot-status{font-family:inherit;font-size:12px;font-weight:600;letter-spacing:0;line-height:1.3;padding:4px 9px;min-height:26px;color:var(--fg);background:transparent;border-color:var(--line)}
html[data-grammar="agenda"] .slot-status::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:6px;flex-shrink:0}
html[data-grammar="agenda"] .slot-status.in-corso::before{background:var(--accent)}
html[data-grammar="agenda"] .slot-actions{gap:6px;margin-top:12px}
html[data-grammar="agenda"] .slot-actions [data-act="advance"]{background:transparent;color:var(--accent);border-color:transparent;box-shadow:none;font-weight:650}
html[data-grammar="agenda"] .slot-actions :is([data-act="edit"],[data-act="del"]){border-color:transparent;background:transparent;display:inline-flex;align-items:center;justify-content:center}
html[data-grammar="agenda"] .slot-actions svg{width:20px;height:20px;stroke-width:1.85;overflow:visible}
html[data-grammar] .pocket-list .card,html[data-grammar] .home-recent .card{border-radius:0;box-shadow:none}
html[data-grammar] .pocket-list>li:not(:last-child){position:relative}
html[data-grammar] .state-empty{padding:24px 4px;border:0}
html[data-grammar] :is(.btn,input,select,textarea,nav button):focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@media(max-width:599px){
 html[data-grammar] header{padding-top:20px}
 html[data-grammar] .brand{font-size:30px}
 html[data-grammar] .slot{grid-template-columns:52px minmax(0,1fr);gap:8px;padding:14px 12px}
 html[data-grammar] .slot-body h2{font-size:17px}
 html[data-grammar] .slot-actions{flex-wrap:wrap}
}
@media(min-width:768px){
 html[data-grammar] header,html[data-grammar] main{padding-left:32px;padding-right:32px}
 html[data-grammar] .brand{font-size:34px}
}
@media(prefers-reduced-motion:no-preference){
 html[data-grammar] .btn{transition:background-color .16s ease,transform .16s ease}
 html[data-grammar] .btn:hover{transform:none}
 html[data-grammar] .btn:active{transform:scale(.98)}
}
@media(prefers-reduced-motion:reduce){html[data-grammar] .btn{transition:none;transform:none}}
</style>\n`;

/** Head-only layer for known composed apps: preserve all body/script bytes. */
export function applyNativeAppStyle(html: string, enabled: boolean): string {
  const end = html.search(/<\/head\s*>/i);
  if (end < 0 || !/<html\b[^>]*\bdata-grammar=/i.test(html) || !/<style\b[^>]*\bdata-fenix-craft(?:\s|>)/i.test(html)) return html;
  const head = html.slice(0, end).replace(/<style data-fenix-native-style="v1">[\s\S]*?<\/style>\n?/g, "");
  return head + (enabled ? STYLE : "") + html.slice(end);
}

/** Contract for tests: the native layer may use tokens, never assign a palette. */
export function nativeStyleAssignsPalette(css: string): boolean {
  return /--(?:bg|surface|elevated|fg|muted|accent|line|accent-ink)\s*:/.test(css) ||
    /#(?:b51246|b01e47|a61d4c)\b/i.test(css);
}
