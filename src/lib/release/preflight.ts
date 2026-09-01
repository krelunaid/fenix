import { validatePublishable } from "../projects/validate-html.ts";
import { blocksPublish } from "../ai/build-contract.ts";
import type { Palette, ProjectKind } from "../projects/types.ts";
import {
  missingStoreRecord,
  validateBundleId,
  validatePackageName,
} from "./ids.ts";
import {
  appleConnected,
  googleConnected,
  netlifyConnected,
  releaseFixtureAllowed,
} from "./secrets.server.ts";
import type { AccountStatus, Platform, ReleaseAccounts, ReleaseConfig } from "./types.ts";
import { REVIEW_NOTE } from "./types.ts";

export function accountsSnapshot(): ReleaseAccounts {
  const fixture = releaseFixtureAllowed();
  const web: AccountStatus = netlifyConnected()
    ? {
        connected: true,
        fixture: false,
        role: "Owner o Developer sul sito Netlify",
        needs: [],
        hint: "Account Netlify collegato sul server. Deploy in production dopo HTML valido.",
      }
    : {
        connected: false,
        fixture: fixture,
        role: "Owner o Developer sul sito Netlify",
        needs: ["token Netlify"],
        hint: fixture
          ? "Nessun token Netlify: lo snapshot Fenix resta la production. Collega Netlify per un sito tuo."
          : "Collega Netlify sul server (token, mai nel browser) per un sito tuo. Lo snapshot Fenix resta disponibile.",
      };
  const ios: AccountStatus = appleConnected()
    ? {
        connected: true,
        fixture: false,
        role: "App Manager o Admin in App Store Connect",
        needs: [],
        hint: "App Store Connect collegato. Upload su TestFlight; la store pubblica resta in review.",
      }
    : {
        connected: false,
        fixture: fixture,
        role: "App Manager o Admin in App Store Connect",
        needs: ["Issuer ID", "Key ID", "chiave API .p8"],
        hint: fixture
          ? "Chiavi Apple assenti: banco di prova (nessun upload reale)."
          : "Collega App Store Connect sul server: chiave API .p8, Issuer ID e Key ID, ruolo App Manager o Admin.",
      };
  const android: AccountStatus = googleConnected()
    ? {
        connected: true,
        fixture: false,
        role: "Release Manager su Google Play Console",
        needs: [],
        hint: "Play Console collegato. Upload sul canale internal; la scheda pubblica resta in review.",
      }
    : {
        connected: false,
        fixture: fixture,
        role: "Release Manager su Google Play Console",
        needs: ["JSON service account"],
        hint: fixture
          ? "Service account Play assente: banco di prova (nessun upload reale)."
          : "Collega Play Console sul server: JSON del service account con ruolo Release Manager.",
      };
  return { web, ios, android, fixture, reviewNote: REVIEW_NOTE };
}

export function gateHtml(html: string, kind: string, projectId: string, palette?: Palette) {
  const report = validatePublishable(html, {
    kind,
    projectId,
    palette,
  });
  const contractBlock = blocksPublish(html, kind);
  if (!report.ok || contractBlock) {
    return {
      ok: false as const,
      error: report.errors[0] || contractBlock || "Il prodotto non è completo, non pubblico.",
      srcDoc: report.srcDoc,
    };
  }
  return { ok: true as const, srcDoc: report.srcDoc };
}

export function gateConfig(config: ReleaseConfig, platforms: Platform[]): string | null {
  if (platforms.includes("ios")) {
    const b = validateBundleId(config.bundleId);
    if (typeof b !== "string") return b.error;
    if (missingStoreRecord(b) && !releaseFixtureAllowed() && !appleConnected()) {
      return `Manca il record App Store Connect per ${b}.`;
    }
  }
  if (platforms.includes("android")) {
    const p = validatePackageName(config.packageName);
    if (typeof p !== "string") return p.error;
    if (missingStoreRecord(p) && !releaseFixtureAllowed() && !googleConnected()) {
      return `Manca l'app in Play Console per ${p}.`;
    }
  }
  return null;
}

export function gatePlatform(platform: Platform): string | null {
  const accounts = accountsSnapshot();
  const row = accounts[platform];
  if (row.connected) return null;
  if (accounts.fixture) return null;
  if (platform === "web") return null;
  return row.hint;
}

export function parseKind(value: unknown): ProjectKind | null {
  const k = String(value || "").toLowerCase();
  if (k === "landing" || k === "app" || k === "dashboard" || k === "tool" || k === "game" || k === "site") {
    return k;
  }
  return null;
}
