type SidebarProps = {
  path: string | null;
  onOpen: () => void;
  onNew: () => void;
};

export function Sidebar({ path, onOpen, onNew }: SidebarProps) {
  const name = path ? path.split(/[/\\]/).pop() || "untitled" : "untitled";

  return (
    <aside className="w-[200px] shrink-0 h-full bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-2">
      <div
        className="text-sm font-medium truncate text-neutral-800 dark:text-neutral-200"
        title={path ?? "untitled"}
      >
        {name}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="text-left text-sm px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
      >
        Open file
      </button>
      <button
        type="button"
        onClick={onNew}
        className="text-left text-sm px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
      >
        New file
      </button>
    </aside>
  );
}
