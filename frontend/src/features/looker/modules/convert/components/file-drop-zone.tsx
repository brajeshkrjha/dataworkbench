"use client";

import { useRef, useState, type DragEvent, type InputHTMLAttributes } from "react";
import { FileUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  collectDirectoryInputEntries,
  collectDroppedEntries,
  type CollectedEntry,
} from "@/features/looker/shared/project-collector";
import { cn } from "@/lib/utils";

export interface SelectedProjectSummary {
  displayName: string;
  fileCount: number;
}

/** Non-standard directory-picker attributes Chromium supports but React's types don't include. */
type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

export function FileDropZone({
  project,
  disabled,
  onSelect,
  onReject,
}: {
  project: SelectedProjectSummary | null;
  disabled?: boolean;
  onSelect: (entries: CollectedEntry[] | null) => void;
  onReject: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleEntries = (entries: CollectedEntry[]) => {
    if (entries.length === 0) {
      onReject("Nothing was selected. Choose the folder containing your .pbip file.");
      return;
    }
    if (entries.length === 1 && /\.pbip$/i.test(entries[0].relativePath)) {
      onReject(
        'Only the .pbip file itself was dropped, so its Report and Semantic Model assets ' +
          'were left behind — browsers can\'t see a file\'s siblings unless its folder is ' +
          'included too. Drag that folder instead, or use "Select PBIP project" below.'
      );
      return;
    }
    onSelect(entries);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const entries = await collectDroppedEntries(event.dataTransfer);
    handleEntries(entries);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  if (project) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{project.displayName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {project.fileCount} {project.fileCount === 1 ? "file" : "files"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove project"
          disabled={disabled}
          onClick={() => onSelect(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const directoryInputProps: DirectoryInputProps = {
    webkitdirectory: "",
    directory: "",
  };

  return (
    <div
      onDrop={(event) => void handleDrop(event)}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors sm:p-10",
        isDragging ? "border-primary bg-accent" : "border-border",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <FileUp className="mb-3 h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium">Drop your PBIP project here</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Select the folder containing your .pbip file — everything else it needs is found
        automatically.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Select PBIP project
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        data-testid="looker-file-input"
        className="hidden"
        multiple
        {...directoryInputProps}
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) {
            handleEntries(collectDirectoryInputEntries(files));
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}
