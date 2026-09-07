/**
 * Generated projects use root-absolute URLs (/styles.css, /api/…, <a href="/clienti">).
 * When previewed under a prefix inside Fenix, those would escape the preview. This
 * rewrites HTML attributes and CSS url() to the prefix and injects a tiny runtime
 * shim so fetch()/XMLHttpRequest/location.assign with root paths stay inside too.
 * Pure functions; no DOM parsing (regex on well-formed generated markup is enough
 * for a preview and keeps this dependency-free).
 */

export function previewPrefix(jobId: string): string {
  return `/api/agent/jobs/${encodeURIComponent(jobId)}/preview`;
}

const ATTR_RE = /\b(href|src|action|poster|formaction)=(["'])(\/[^"']*)/gi;
const SRCSET_RE = /\bsrcset=(["'])([^"']+)\1/gi;
const CSS_URL_RE = /url\((\s*["']?)(\/[^)"']*)/gi;

function prefixed(path: string, p: string): string {
  if (path.startsWith("//") || path === p || path.startsWith(`${p}/`)) return path;
  return `${p}${path}`;
}

export function rewritePreviewHtml(html: string, prefix: string): string {
  const p = prefix.replace(/\/$/, "");
  let out = html.replace(ATTR_RE, (_m, attr: string, q: string, path: string) => `${attr}=${q}${prefixed(path, p)}`);
  out = out.replace(SRCSET_RE, (_m, q: string, list: string) => {
    const rewritten = list.split(",").map((part) => {
      const t = part.trim();
      return t.startsWith("/") ? prefixed(t, p) : t;
    }).join(", ");
    return `srcset=${q}${rewritten}${q}`;
  });
  out = out.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m) => rewritePreviewCss(m, p));
  if (out.includes("data-fenix-preview")) return out;
  const shim = `<script data-fenix-preview>(function(p){` +
    `var fix=function(u){try{if(typeof u==="string"&&u.charAt(0)==="/"&&u.charAt(1)!=="/"&&u.indexOf(p)!==0)return p+u;}catch(e){}return u;};` +
    `var f=window.fetch;if(f)window.fetch=function(u,o){return f.call(this,(u instanceof Request)?new Request(fix(u.url),u):fix(u),o);};` +
    `var X=window.XMLHttpRequest&&window.XMLHttpRequest.prototype;if(X&&X.open){var o=X.open;X.open=function(m,u){arguments[1]=fix(u);return o.apply(this,arguments);};}` +
    `var L=window.location,a=L.assign.bind(L),r=L.replace.bind(L);try{L.assign=function(u){a(fix(u));};L.replace=function(u){r(fix(u));};}catch(e){}` +
    `document.addEventListener("submit",function(e){var t=e.target;if(t&&t.getAttribute){var ac=t.getAttribute("action");if(ac&&ac.charAt(0)==="/"&&ac.indexOf(p)!==0)t.setAttribute("action",p+ac);}},true);` +
    `})(${JSON.stringify(p)});</script>`;
  if (/<head[^>]*>/i.test(out)) return out.replace(/<head[^>]*>/i, (m) => `${m}${shim}`);
  return shim + out;
}

export function rewritePreviewCss(css: string, prefix: string): string {
  const p = prefix.replace(/\/$/, "");
  return css.replace(CSS_URL_RE, (_x, q: string, path: string) => `url(${q}${prefixed(path, p)}`);
}

/** Headers safe to forward from the relayed response to the browser. */
export function previewResponseHeaders(contentType: string): Record<string, string> {
  return {
    "content-type": contentType || "application/octet-stream",
    "cache-control": "no-store",
    "content-security-policy": "frame-ancestors 'self'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}
