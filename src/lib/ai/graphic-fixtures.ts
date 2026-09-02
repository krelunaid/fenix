import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatPrefix } from "../projects/infer.ts";
import type { Palette, ProjectKind } from "../projects/types.ts";
import { tokensFromBrief } from "../projects/design-tokens.ts";
import { loadPremiumFixtures, type PremiumFixtureId } from "./premium-fixtures.ts";

const here = dirname(fileURLToPath(import.meta.url));

export type GraphicFixtureId =
  | "essenza-fail"
  | "maison-lumiere"
  | "sfilata-atelier"
  | "sala-ore"
  | PremiumFixtureId;

export type GraphicFixture = {
  id: GraphicFixtureId;
  family: string;
  brief: string;
  html: string;
  palette: Palette;
  mustPass: boolean;
  kind?: ProjectKind;
};

function loadHtml(name: string): string {
  return readFileSync(join(here, "fixtures/graphic", name), "utf8");
}

export function loadLegacyGraphicFixtures(): GraphicFixture[] {
  const perfumeBrief = `${formatPrefix("app")}Maison Lumière: gestione profumi premium, flaconi, note olfattive e guardaroba.`;
  const fashionBrief = `${formatPrefix("app")}Sfilata Atelier: moda e vendite, lookbook, capi in passerella e cassa.`;
  const bookingBrief = `${formatPrefix("app")}Sala delle Ore: prenotazioni di un servizio, agenda, trattamenti e studio.`;
  const failBrief = `${formatPrefix("app")}Essenza: gestione profumi premium in tasca.`;
  return [
    {
      id: "essenza-fail",
      family: "regressione Essenza",
      brief: failBrief,
      html: loadHtml("essenza-fail.html"),
      palette: tokensFromBrief(failBrief).palette,
      mustPass: false,
      kind: "app",
    },
    {
      id: "maison-lumiere",
      family: "profumi premium (legacy geometrico)",
      brief: perfumeBrief,
      html: loadHtml("maison-lumiere.html"),
      palette: tokensFromBrief(perfumeBrief).palette,
      mustPass: false,
      kind: "app",
    },
    {
      id: "sfilata-atelier",
      family: "moda/vendite (legacy card-clone)",
      brief: fashionBrief,
      html: loadHtml("sfilata-atelier.html"),
      palette: tokensFromBrief(fashionBrief).palette,
      mustPass: false,
      kind: "app",
    },
    {
      id: "sala-ore",
      family: "prenotazioni servizio (legacy schematico)",
      brief: bookingBrief,
      html: loadHtml("sala-ore.html"),
      palette: tokensFromBrief(bookingBrief).palette,
      mustPass: false,
      kind: "app",
    },
  ];
}

export function loadGraphicFixtures(): GraphicFixture[] {
  return [...loadLegacyGraphicFixtures(), ...loadPremiumFixtures()];
}
