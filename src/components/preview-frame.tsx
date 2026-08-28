import { useMemo } from "react";
import { prepareSrcDoc } from "@/lib/projects/color-scheme";
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
  className,
}: {
  html: string;
  name: string;
  device: Device;
  background?: string;
  className?: string;
}) {
  const width = WIDTH[device];
  const srcDoc = useMemo(
    () => (html ? prepareSrcDoc(html, background ?? "#ffffff") : ""),
    [html, background],
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="size-2 rounded-full bg-border" />
          <i className="size-2 rounded-full bg-border" />
          <i className="size-2 rounded-full bg-border" />
        </span>
        <div className="flex h-6 min-w-0 flex-1 items-center rounded-sm bg-raised px-3">
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {name.toLowerCase().replace(/\s+/g, "")}.preview
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-background p-2 sm:p-4">
        <div
          className={cn(
            "h-full overflow-hidden rounded-lg border border-border bg-card shadow-soft",
            device === "desktop" ? "w-full" : "mx-auto",
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
              style={{ background: background ?? "var(--color-card)" }}
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
