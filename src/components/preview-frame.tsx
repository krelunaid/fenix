import { useEffect, useMemo } from "react";
import { prepareSrcDoc, type SrcPalette } from "@/lib/projects/color-scheme";
import { rememberAudit, rememberBootError, rememberBootOk, rememberShot, type PreviewAudit } from "@/lib/ai/look";
import { notePreviewBootError } from "@/lib/projects/store";
import { cn } from "@/lib/utils";

export type Device = "desktop" | "tablet" | "mobile";

const WIDTH: Record<Device, number | "100%"> = {
  desktop: "100%",
  tablet: 768,
  mobile: 390,
};

export function PreviewFrame({
  html,
  files,
  name,
  device,
  background,
  palette,
  projectId,
  kind,
  className,
}: {
  html: string;
  files?: { path: string; content: string }[];
  name: string;
  device: Device;
  background?: string;
  palette?: SrcPalette;
  projectId?: string;
  kind?: string;
  className?: string;
}) {
  const width = WIDTH[device];
  const srcDoc = useMemo(() => {
    const tokens = palette ?? { bg: background ?? "#ffffff" };
    return html ? prepareSrcDoc(html, tokens, projectId ?? "preview", kind) : "";
  }, [html, background, palette, projectId, kind]);

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
        message?: string;
      };
      if (msg?.t === "fenix-shot" && typeof msg.data === "string") {
        rememberShot(msg.data);
        return;
      }
      if (msg?.t === "fenix-boot-error") {
        const text = String(msg.message || "errore in avvio");
        rememberBootError(text);
        notePreviewBootError(projectId ?? "preview", text);
        return;
      }
      if (msg?.t === "fenix-boot-ok") {
        rememberBootOk();
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
          {srcDoc ? (
            <div className="relative h-full min-h-[70vh] w-full">
              <iframe
                key={`${name}-${srcDoc.length}`}
                title={`Anteprima ${name}`}
                data-preview={device}
                sandbox="allow-scripts allow-forms allow-modals"
                srcDoc={srcDoc}
                className="absolute inset-0 h-full w-full border-0 bg-white"
                style={{
                  background: background ?? "var(--color-card)",
                  overflow: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              />
            </div>
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
