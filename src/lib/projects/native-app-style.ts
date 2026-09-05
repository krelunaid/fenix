/** Original native-inspired controls. No brand assets, palette or data rewrites. */
const STYLE = `<style data-fenix-native-style="v1">
html[data-grammar] body{font-size:17px;line-height:1.45}
html[data-grammar] header{padding:24px 20px 16px;align-items:center;gap:16px;background:var(--bg);border-bottom:0;flex-wrap:wrap}
html[data-grammar] header>div{min-width:0;flex:1 1 180px}
html[data-grammar] .brand{font-size:32px;font-weight:700;font-style:normal;line-height:1.12;letter-spacing:-.03em;text-transform:none;overflow-wrap:anywhere}
html[data-grammar] header .kicker{font-size:12px;letter-spacing:.06em;margin-bottom:5px}
html[data-grammar] header .place{font-size:13px;line-height:1.4}
html[data-grammar] main{padding-left:20px;padding-right:20px}
html[data-grammar] :is(.card,.fragrance,.slot,.ticket,.room,.look,.kpi,.measure,.home-hero,.persona-privacy,.wipe-box){border-radius:18px;box-shadow:0 2px 8px color-mix(in srgb,var(--fg) 4%,transparent)}
html[data-grammar] :is(.card,.slot,.ticket,.room,.kpi,.measure){border-color:color-mix(in srgb,var(--line) 60%,var(--surface))}
html[data-grammar] :is(.card,.fragrance,.slot,.ticket,.room,.look) h2{font-size:19px;line-height:1.25;font-weight:650;letter-spacing:-.02em}
html[data-grammar] :is(.home-first,.list-head,.persona-pane)>h2{font-size:24px;line-height:1.2;letter-spacing:-.025em}
html[data-grammar] :is(.home-aside,.persona-facts) .card h2{font-size:17px}
html[data-grammar] .notes{font-size:15px;line-height:1.5}
html[data-grammar] .btn{min-height:48px;min-width:44px;padding:12px 18px;border-radius:14px;font-size:16px;font-weight:600;line-height:1.25;letter-spacing:-.01em;touch-action:manipulation}
html[data-grammar] .btn.ghost{background:var(--surface);color:var(--fg);border:1px solid var(--line)}
html[data-grammar] .btn.sm{min-height:44px;padding:10px 12px;font-size:14px}
html[data-grammar] :is(input,select,textarea){min-height:48px;padding:12px 14px;border-radius:12px;font-size:17px;line-height:1.4;background:var(--surface)}
html[data-grammar] label{font-size:14px;line-height:1.4;letter-spacing:0;margin-top:18px;margin-bottom:7px}
html[data-grammar] nav.tabs{background:var(--surface);border-top:1px solid var(--line);box-shadow:none}
html[data-grammar] nav.tabs button{min-height:48px;gap:5px;font-size:12px;font-weight:600;line-height:1.2;padding:6px 4px}
html[data-grammar] nav.tabs button.on{background:var(--surface);color:var(--fg);border-radius:12px;box-shadow:inset 0 -2px 0 var(--accent)}
html[data-grammar] :is(nav.tabs,nav.rail) svg{width:28px;height:28px;flex:0 0 28px;stroke-width:1.8}
html[data-grammar] :is(nav.tabs,nav.rail) button.on svg{stroke-width:2.2}
html[data-grammar] nav.rail button{min-height:44px;border-radius:12px;line-height:1.3}
html[data-grammar] .week-day{border-radius:12px;min-height:64px}
html[data-grammar="agenda"] .day-head{padding:2px 0 18px}
html[data-grammar="agenda"] .day-head .kicker{font-size:14px;letter-spacing:0;margin-bottom:5px;text-transform:none}
html[data-grammar="agenda"] .day-head .kicker::first-letter{text-transform:uppercase}
html[data-grammar="agenda"] .day-head h2{font-size:24px;line-height:1.2;letter-spacing:-.025em}
html[data-grammar="agenda"] .day-rail{gap:12px}
html[data-grammar="agenda"] .slot-body{min-width:0}
html[data-grammar="agenda"] .slot-detail{margin:4px 0 9px;overflow-wrap:anywhere}
html[data-grammar="agenda"] .slot-status{font-family:inherit;font-size:12px;font-weight:600;letter-spacing:0;line-height:1.3;padding:4px 9px;min-height:26px;color:var(--fg);background:var(--surface);border-color:var(--line)}
html[data-grammar="agenda"] .slot-status::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:6px;flex-shrink:0}
html[data-grammar="agenda"] .slot-status.in-corso::before{background:var(--accent)}
html[data-grammar="agenda"] .slot-actions{gap:6px;margin-top:12px}
html[data-grammar="agenda"] .slot-actions [data-act="advance"]{background:var(--accent);color:var(--accent-ink);border:1px solid var(--accent);box-shadow:none}
html[data-grammar="agenda"] .slot-actions :is([data-act="edit"],[data-act="del"]){border-color:transparent;background:transparent;display:inline-flex;align-items:center;justify-content:center}
html[data-grammar="agenda"] .slot-actions svg{width:20px;height:20px;stroke-width:1.7;overflow:visible}
html[data-grammar] .pocket-list .card,html[data-grammar] .home-recent .card{border-radius:0;box-shadow:none}
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
