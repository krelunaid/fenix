import { useEffect, useMemo } from "react";
import { prepareSrcDoc } from "@/lib/projects/color-scheme";
import { rememberAudit, rememberShot, type PreviewAudit } from "@/lib/ai/look";
import { useProjectStore } from "@/lib/projects/store";
import { cn } from "@/lib/utils";

export type Device = "desktop" | "tablet" | "mobile";

const WIDTH: Record<Device, number | "100%"> = {
  desktop: "100%",
  tablet: 768,
  mobile: 390,
};

export function PreviewFrame({
  html,
  name,
  device,
  background,
  projectId,
  className,
}: {
  html: string;
  name: string;
  device: Device;
  background?: string;
  projectId?: string;
  className?: string;
}) {
  const width = WIDTH[device];
  const srcDoc = useMemo(
    () => (html ? prepareSrcDoc(html, background ?? "#ffffff", projectId ?? "preview") : ""),
    [html, background, projectId],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data as {
        t?: string;
        id?: string;
        op?: string;
        projectId?: string;
        col?: string;
        data?: unknown;
        svgs?: number;
        tabs?: number;
        forms?: number;
        inputs?: number;
        hasIcon?: boolean;
        title?: string;
        vw?: number;
        sw?: number;
        mainChars?: number;
      };
      if (msg?.t === "fenix-shot" && typeof msg.data === "string") {
        rememberShot(msg.data);
        return;
      }
      if (msg?.t === "fenix-audit") {
        rememberAudit({
          svgs: Number(msg.svgs) || 0,
          tabs: Number(msg.tabs) || 0,
          forms: Number(msg.forms) || 0,
          inputs: Number(msg.inputs) || 0,
          hasIcon: Boolean(msg.hasIcon),
          title: String(msg.title || ""),
          vw: Number(msg.vw) || 0,
          sw: Number(msg.sw) || 0,
          mainChars: Number(msg.mainChars) || 0,
        } satisfies PreviewAudit);
        return;
      }
      if (!msg || msg.t !== "fenix-db" || !msg.id || !msg.col) return;
      const id = msg.projectId || projectId;
      if (!id) return;
      const store = useProjectStore.getState();
      let value: unknown = null;
      if (msg.op === "load") value = store.loadAppData(id, msg.col);
      if (msg.op === "save") {
        store.saveAppData(id, msg.col, msg.data);
        value = msg.data;
      }
      const source = event.source as Window | null;
      source?.postMessage({ t: "fenix-db", id: msg.id, v: value }, "*");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [projectId]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="size-2 rounded-full bg-border" />
          <i className="size-2 rounded-full bg-border" />
          <i className="size-2 rounded-full bg-border" />
        </span>
        <div className="flex h-6 min-w-0 flex-1 items-center rounded-sm bg-raised px-3">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {name.toLowerCase().replace(/\s+/g, "")}.preview
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-background">
        <div
          className={cn(
            "h-full overflow-hidden bg-card",
            device === "desktop" ? "w-full" : "mx-auto border-x border-border",
          )}
          style={width === "100%" ? { width: "100%" } : { width, maxWidth: "100%" }}
        >
          {html ? (
            <iframe
              key={name}
              title={`Anteprima ${name}`}
              sandbox="allow-scripts allow-forms allow-modals"
              srcDoc={srcDoc}
              className="h-full w-full border-0"
              style={{ background: background ?? "var(--color-card)", overflow: "auto" }}
            />
          ) : (
            <div className="grid h-full place-items-center px-8 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                L'anteprima apparirà qui appena lo studio avrà composto l'interfaccia.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
