"use client";

import { useRef, useState, type DragEvent, type InputHTMLAttributes } from "react";
import { FolderUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BulkFolderSummary } from "@/features/looker/modules/convert/hooks/use-bulk-conversion";
import {
  collectDirectoryInputEntries,
  collectDroppedEntries,
  type CollectedEntry,
} from "@/features/looker/shared/project-collector";
import { expandZipSelection } from "@/features/looker/shared/zip-reader";
import { cn } from "@/lib/utils";

type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

/** Upload control for Bulk Conversion: a single parent folder containing many PBIP
 * project subfolders. No manual project selection - the backend discovers them all. */
export function BulkUploadDropZone({
  folder,
  disabled,
  onSelect,
  onReject,
}: {
  folder: BulkFolderSummary | null;
  disabled?: boolean;
  onSelect: (entries: CollectedEntry[] | null) => void;
  onReject: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingZip, setIsReadingZip] = useState(false);

  const handleEntries = async (selected: CollectedEntry[]) => {
    let entries = selected;
    try {
      if (selected.length === 1 && /\.zip$/i.test(selected[0].relativePath)) setIsReadingZip(true);
      entries = await expandZipSelection(selected);
    } catch (err) {
      onReject(err instanceof Error ? err.message : "Could not read the ZIP file.");
      return;
    } finally {
      setIsReadingZip(false);
    }
    if (entries.length === 0) {
      onReject("Nothing was selected. Choose the parent folder or ZIP containing your PBIP projects.");
      return;
    }
    onSelect(entries);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const entries = await collectDroppedEntries(event.dataTransfer);
    await handleEntries(entries);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  if (folder) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{folder.displayName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{folder.fileCount} files scanned</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Remove folder" disabled={disabled} onClick={() => onSelect(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const directoryInputProps: DirectoryInputProps = { webkitdirectory: "", directory: "" };

  return (
    <div
      onClick={() => !isReadingZip && inputRef.current?.click()}
      onDrop={(event) => void handleDrop(event)}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors sm:p-10",
        isDragging ? "border-primary bg-accent" : "border-border",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <FolderUp className="mb-3 h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium">Drop a parent folder (or .zip) containing many PBIP projects</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Every valid `.pbip` project inside is discovered automatically — no manual selection needed.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" disabled={isReadingZip} onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          <FolderUp className="h-3.5 w-3.5" />
          Select parent folder
        </Button>
        <Button variant="outline" size="sm" disabled={isReadingZip} onClick={(e) => { e.stopPropagation(); zipInputRef.current?.click(); }}>
          {isReadingZip ? "Reading ZIP..." : "Select ZIP"}
        </Button>
      </div>
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        data-testid="bulk-zip-input"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleEntries([{ relativePath: file.name, file }]);
          event.target.value = "";
        }}
      />
      <input
        ref={inputRef}
        type="file"
        data-testid="bulk-folder-input"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        multiple
        {...directoryInputProps}
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) {
            void handleEntries(collectDirectoryInputEntries(files));
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}
