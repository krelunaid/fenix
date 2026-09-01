import { useMemo, useState } from "react";
import { ChevronRight, FileText, Folder } from "lucide-react";
import { fileTree, type FileTreeNode, type ProjectFile } from "@/lib/projects/files";
import { cn } from "@/lib/utils";

export function FileTree({
  files,
  activePath,
  onSelect,
}: {
  files: ProjectFile[];
  activePath?: string;
  onSelect: (path: string) => void;
}) {
  const nodes = useMemo(() => fileTree(files), [files]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const current = files.find((f) => f.path === activePath) ?? files[0];

  function isOpen(path: string) {
    return open[path] !== false;
  }

  function toggle(path: string) {
    setOpen((prev) => ({ ...prev, [path]: prev[path] === false }));
  }

  function render(node: FileTreeNode, depth: number) {
    if (node.kind === "dir") {
      const expanded = isOpen(node.path);
      return (
        <li key={node.path} role="none">
          <button
            type="button"
            role="treeitem"
            aria-expanded={expanded}
            aria-label={node.path}
            onClick={() => toggle(node.path)}
            style={{ paddingLeft: 8 + depth * 12 }}
            className="flex min-h-11 w-full items-center gap-2 rounded-md text-left text-sm text-muted-foreground hover:bg-raised hover:text-foreground"
          >
            <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")} />
            <Folder className="size-3.5 shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
          {expanded ? (
            <ul role="group" className="m-0 list-none p-0">
              {node.children.map((child) => render(child, depth + 1))}
            </ul>
          ) : null}
        </li>
      );
    }
    const selected = current?.path === node.path;
    return (
      <li key={node.path} role="none">
        <button
          type="button"
          role="treeitem"
          aria-selected={selected}
          aria-label={node.path}
          onClick={() => onSelect(node.path)}
          style={{ paddingLeft: 28 + depth * 12 }}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-md text-left font-mono text-xs hover:bg-raised",
            selected ? "bg-raised text-foreground" : "text-muted-foreground",
          )}
        >
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
      </li>
    );
  }

  if (!current) {
    return (
      <div className="grid h-full place-items-center bg-card text-sm text-muted-foreground">
        Nessun codice ancora.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card md:flex-row">
      <nav
        className="max-h-[42%] shrink-0 overflow-auto border-b border-border md:max-h-none md:h-full md:w-56 md:border-r md:border-b-0"
        aria-label="Albero file"
      >
        <p className="px-3 pt-3 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          File
        </p>
        <ul role="tree" aria-label="Albero file" className="m-0 list-none p-2">
          {nodes.map((node) => render(node, 0))}
        </ul>
      </nav>
      <pre
        aria-label={`Contenuto ${current.path}`}
        className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap"
      >
        {current.content}
      </pre>
    </div>
  );
}
