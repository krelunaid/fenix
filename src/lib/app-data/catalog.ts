import { ConnectorType, type ConnectorTypeName } from "./types.ts";

export type ConnectorCatalogEntry = {
  type: ConnectorTypeName;
  label: string;
  family: "google" | "microsoft" | "mcp";
  authentication: "edge-gate";
  credentialExposure: "server-only";
  toolAuthorization: "grant-allowlist";
  catalogIdRequired: boolean;
};

/**
 * Connector families accepted by the Fenix server-side gate client.
 * This is a runtime contract, not a claim that a user's account is connected.
 */
export const FENIX_CONNECTOR_CATALOG: readonly ConnectorCatalogEntry[] = [
  {
    type: ConnectorType.GoogleDrive,
    label: "Google Drive",
    family: "google",
    authentication: "edge-gate",
    credentialExposure: "server-only",
    toolAuthorization: "grant-allowlist",
    catalogIdRequired: false,
  },
  {
    type: ConnectorType.Gmail,
    label: "Gmail",
    family: "google",
    authentication: "edge-gate",
    credentialExposure: "server-only",
    toolAuthorization: "grant-allowlist",
    catalogIdRequired: false,
  },
  {
    type: ConnectorType.GoogleCalendar,
    label: "Google Calendar",
    family: "google",
    authentication: "edge-gate",
    credentialExposure: "server-only",
    toolAuthorization: "grant-allowlist",
    catalogIdRequired: false,
  },
  {
    type: ConnectorType.Outlook,
    label: "Outlook",
    family: "microsoft",
    authentication: "edge-gate",
    credentialExposure: "server-only",
    toolAuthorization: "grant-allowlist",
    catalogIdRequired: false,
  },
  {
    type: ConnectorType.OutlookCalendar,
    label: "Outlook Calendar",
    family: "microsoft",
    authentication: "edge-gate",
    credentialExposure: "server-only",
    toolAuthorization: "grant-allowlist",
    catalogIdRequired: false,
  },
  {
    type: ConnectorType.MicrosoftTeams,
    label: "Microsoft Teams",
    family: "microsoft",
    authentication: "edge-gate",
    credentialExposure: "server-only",
    toolAuthorization: "grant-allowlist",
    catalogIdRequired: false,
  },
  {
    type: ConnectorType.Mcp,
    label: "MCP catalog",
    family: "mcp",
    authentication: "edge-gate",
    credentialExposure: "server-only",
    toolAuthorization: "grant-allowlist",
    catalogIdRequired: true,
  },
] as const;

export function connectorCatalogEntry(
  type: ConnectorTypeName,
): ConnectorCatalogEntry | null {
  return FENIX_CONNECTOR_CATALOG.find((entry) => entry.type === type) ?? null;
}
