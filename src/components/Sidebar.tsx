export type FileEntry = {
  name: string;
  path: string;
};

type SidebarProps = {
  folder: string | null;
  files: FileEntry[];
  activePath: string | null;
  onOpenFolder: () => void;
  onSelectFile: (path: string) => void;
};

function folderName(folder: string | null): string {
  if (!folder) return "No folder open";
  return folder.split(/[/\\]/).filter(Boolean).pop() ?? folder;
}

export function Sidebar({
  folder,
  files,
  activePath,
  onOpenFolder,
  onSelectFile,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[220px] flex-none flex-col border-r border-border-muted bg-sidebar text-sidebar-fg">
      <div className="flex items-center justify-between gap-2 border-b border-border-muted px-3 py-2">
        <span className="truncate text-xs font-medium uppercase tracking-wide">
          {folderName(folder)}
        </span>
        <button
          type="button"
          onClick={onOpenFolder}
          className="rounded px-2 py-0.5 text-xs hover:bg-sidebar-active hover:text-sidebar-active-fg"
        >
          Open
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {folder === null ? (
          <div className="px-3 py-2 text-xs text-muted">
            Open a folder to browse its markdown files.
          </div>
        ) : files.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted">
            No .md files in this folder.
          </div>
        ) : (
          <ul>
            {files.map((file) => {
              const isActive = file.path === activePath;
              return (
                <li key={file.path}>
                  <button
                    type="button"
                    onClick={() => onSelectFile(file.path)}
                    className={`block w-full truncate px-3 py-1 text-left text-sm ${
                      isActive
                        ? "bg-sidebar-active text-sidebar-active-fg"
                        : "hover:bg-sidebar-active hover:text-sidebar-active-fg"
                    }`}
                    title={file.path}
                  >
                    {file.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
