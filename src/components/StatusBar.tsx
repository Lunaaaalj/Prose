type StatusBarProps = {
  filename: string;
  isDirty: boolean;
  wordCount: number;
  charCount: number;
};

export function StatusBar({ filename, isDirty, wordCount, charCount }: StatusBarProps) {
  return (
    <footer className="flex h-7 flex-none items-center justify-between border-t border-border-muted bg-status px-3 text-xs text-status-fg">
      <div className="flex items-center gap-3 truncate">
        <span className="truncate" title={filename}>
          {filename}
        </span>
        <span>{isDirty ? "Unsaved changes" : "Saved"}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
      </div>
    </footer>
  );
}
