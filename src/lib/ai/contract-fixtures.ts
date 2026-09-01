import type { ProjectFile } from "../projects/files.ts";
import { DEMOS } from "../projects/demos.ts";
import { DASHBOARD_MOCK } from "../projects/fixtures/trees.ts";
import { formatPrefix } from "../projects/infer.ts";
import type { Palette } from "../projects/types.ts";

export type ContractFixtureId = "gestionale-crud" | "consumer-mobile" | "dashboard-multifile";

export type ContractFixture = {
  id: ContractFixtureId;
  family: string;
  brief: string;
  html: string;
  files: ProjectFile[];
  palette: Palette;
};

/** Three distinct families: gestionale CRUD, consumer/mobile, dashboard multi-file. */
export function loadContractFixtures(): ContractFixture[] {
  const kiln = DEMOS.kiln;
  const grotta = DEMOS.grottaglie;
  const extra = DASHBOARD_MOCK.filter((f) => f.path !== "index.html");
  return [
    {
      id: "gestionale-crud",
      family: "gestionale CRUD",
      brief: `${formatPrefix("dashboard")}Kiln — cruscotto forno, colate e rischi in officina.`,
      html: kiln.html,
      files: [{ path: "index.html", content: kiln.html }],
      palette: kiln.palette,
    },
    {
      id: "consumer-mobile",
      family: "consumer/mobile",
      brief: `${formatPrefix("app")}Fornace Grottaglie: forni, pezzi e ordini in bottega a Grottaglie.`,
      html: grotta.html,
      files: [{ path: "index.html", content: grotta.html }],
      palette: grotta.palette,
    },
    {
      id: "dashboard-multifile",
      family: "dashboard full-stack/multi-file",
      brief: `${formatPrefix("dashboard")}Kiln con ordini, dati mock e API locale. Nessun server inventato.`,
      html: kiln.html,
      files: [{ path: "index.html", content: kiln.html }, ...extra],
      palette: kiln.palette,
    },
  ];
}
