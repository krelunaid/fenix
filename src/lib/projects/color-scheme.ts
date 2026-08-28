export function isLightHex(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

const NAV_GUARD = `<script data-officina-guard>
document.addEventListener("click", function (e) {
  var n = e.target;
  if (n && n.nodeType !== 1) n = n.parentElement;
  var a = n && n.closest ? n.closest("a") : null;
  if (!a) return;
  var href = a.getAttribute("href") || "";
  if (href.charAt(0) === "#") {
    e.preventDefault();
    var id = decodeURIComponent(href.slice(1));
    var el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  e.preventDefault();
}, true);
</script>`;

export function prepareSrcDoc(html: string, bg: string) {
  if (!html) return "";
  const scheme = isLightHex(bg) ? "light" : "dark";
  let next = html;
  if (!/color-scheme/i.test(next)) {
    const meta = `<meta name="color-scheme" content="${scheme}"/>`;
    next = /<head[^>]*>/i.test(next)
      ? next.replace(/<head[^>]*>/i, (open) => `${open}${meta}`)
      : `${meta}${next}`;
  }
  if (!/data-officina-guard/.test(next)) {
    next = /<\/body>/i.test(next)
      ? next.replace(/<\/body>/i, `${NAV_GUARD}</body>`)
      : `${next}${NAV_GUARD}`;
  }
  return next;
}
