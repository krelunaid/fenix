const DEFAULT_SITE = "https://fenix.kreluna.it";
const DEFAULT_RAILWAY = "https://fenix-production-d9f5.up.railway.app/health";
const SHA_RE = /^[a-f0-9]{40}$/;

function integer(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function smokeConfig(env = process.env) {
  const expectedSha = String(env.FENIX_EXPECTED_SHA || env.GITHUB_SHA || "").trim();
  if (!SHA_RE.test(expectedSha)) {
    return { error: "FENIX_EXPECTED_SHA deve essere uno SHA Git completo." };
  }
  let site;
  let railway;
  try {
    site = new URL(env.FENIX_PRODUCTION_URL || DEFAULT_SITE);
    railway = new URL(env.FENIX_RAILWAY_HEALTH_URL || DEFAULT_RAILWAY);
  } catch {
    return { error: "URL produzione non valido." };
  }
  if (site.protocol !== "https:" || railway.protocol !== "https:") {
    return { error: "Gli endpoint produzione devono usare HTTPS." };
  }
  return {
    expectedSha,
    site: site.origin,
    railway: railway.href,
    attempts: integer(env.FENIX_SMOKE_ATTEMPTS, 24, 1, 40),
    waitMs: integer(env.FENIX_SMOKE_WAIT_MS, 15_000, 0, 30_000),
    requestTimeoutMs: integer(env.FENIX_SMOKE_REQUEST_TIMEOUT_MS, 10_000, 1_000, 30_000),
    sloMs: integer(env.FENIX_SMOKE_SLO_MS, 8_000, 500, 30_000),
  };
}

async function fetchTimed(url, init, deps) {
  const started = deps.now();
  const response = await deps.fetchFn(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(deps.requestTimeoutMs),
  });
  return { response, elapsedMs: Math.round(deps.now() - started) };
}

async function json(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function probeProduction(config, overrides = {}) {
  const deps = {
    fetchFn: overrides.fetchFn || fetch,
    now: overrides.now || (() => performance.now()),
    requestTimeoutMs: config.requestTimeoutMs,
  };
  const releaseProbe = await fetchTimed(`${config.site}/fenix-release.json`, {}, deps);
  const release = await json(releaseProbe.response);
  if (releaseProbe.response.status !== 200 || !release || typeof release !== "object") {
    return { ready: false, retry: true, reason: "manifest produzione non disponibile" };
  }
  if (release.sha !== config.expectedSha) {
    return {
      ready: false,
      retry: true,
      reason: `deploy ancora su ${String(release.sha || "sha assente").slice(0, 12)}`,
    };
  }
  const asset = Array.isArray(release.assets) ? release.assets[0] : null;
  if (typeof asset !== "string" || !/^index-[A-Za-z0-9_-]+\.js$/.test(asset)) {
    return { ready: false, retry: false, reason: "asset principale non valido" };
  }

  const rootProbe = await fetchTimed(`${config.site}/`, {}, deps);
  const assetProbe = await fetchTimed(`${config.site}/assets/${asset}`, {}, deps);
  const edgeProbe = await fetchTimed(
    `${config.site}/api/build`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    },
    deps,
  );
  const edge = await json(edgeProbe.response);
  const railwayProbe = await fetchTimed(config.railway, {}, deps);
  const railway = await json(railwayProbe.response);
  const timings = {
    release: releaseProbe.elapsedMs,
    root: rootProbe.elapsedMs,
    asset: assetProbe.elapsedMs,
    edge: edgeProbe.elapsedMs,
    railway: railwayProbe.elapsedMs,
  };
  const slow = Object.entries(timings).filter(([, ms]) => ms > config.sloMs);
  if (slow.length) {
    return {
      ready: false,
      retry: false,
      reason: `SLO ${config.sloMs}ms superato: ${slow.map(([name, ms]) => `${name}=${ms}`).join(", ")}`,
      timings,
    };
  }
  if (rootProbe.response.status !== 200 || assetProbe.response.status !== 200) {
    return {
      ready: false,
      retry: false,
      reason: "root o asset produzione non raggiungibile",
      timings,
    };
  }
  if (
    edgeProbe.response.status !== 400 ||
    edge?.t !== "err" ||
    edge?.error !== "Scrivi cosa vuoi costruire."
  ) {
    return { ready: false, retry: false, reason: "Edge Function non conforme", timings };
  }
  if (
    railwayProbe.response.status !== 200 ||
    railway?.ok !== true ||
    railway?.model !== "grok-build-0.1" ||
    !Number.isFinite(Number(railway?.passes))
  ) {
    return { ready: false, retry: false, reason: "Railway health non conforme", timings };
  }
  return {
    ready: true,
    sha: config.expectedSha,
    asset,
    timings,
    edge: { status: edgeProbe.response.status },
    railway: { ok: true, model: railway.model, passes: Number(railway.passes) },
  };
}

export async function pollProduction(config, overrides = {}) {
  const sleep = overrides.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let last;
  for (let attempt = 1; attempt <= config.attempts; attempt += 1) {
    try {
      last = await probeProduction(config, overrides);
    } catch (error) {
      last = {
        ready: false,
        retry: true,
        reason: error instanceof Error ? error.message : "errore rete",
      };
    }
    if (last.ready || !last.retry) return { ...last, attempt };
    if (attempt < config.attempts) await sleep(config.waitMs);
  }
  return { ...last, ready: false, retry: false, attempts: config.attempts };
}

async function main() {
  const config = smokeConfig();
  if ("error" in config) {
    console.error(JSON.stringify(config));
    process.exitCode = 2;
    return;
  }
  const result = await pollProduction(config);
  const line = JSON.stringify(result);
  if (result.ready) console.log(line);
  else {
    console.error(line);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
