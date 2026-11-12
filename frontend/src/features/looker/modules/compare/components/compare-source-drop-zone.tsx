"use client";

import { useRef, useState, type DragEvent, type InputHTMLAttributes } from "react";
import { FileArchive, FileUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CompareSlotSummary } from "@/features/looker/modules/compare/use-lookml-compare";
import {
  collectDirectoryInputEntries,
  collectDroppedEntries,
  type CollectedEntry,
} from "@/features/looker/shared/project-collector";
import { cn } from "@/lib/utils";

/** Non-standard directory-picker attributes Chromium supports but React's types don't include. */
type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

/**
 * Upload control for one side of the Compare module. Accepts either a PBIP
 * project folder (zipped client-side, as before) or an already-generated
 * LookML package `.zip` file, dropped or picked directly — no manual
 * "what kind of file is this" choice. The backend auto-detects the real
 * source type from the archive's contents once uploaded.
 */
export function CompareSourceDropZone({
  slot,
  disabled,
  onSelect,
  onReject,
}: {
  slot: CompareSlotSummary | null;
  disabled?: boolean;
  onSelect: (entries: CollectedEntry[] | null) => void;
  onReject: (message: string) => void;
}) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleEntries = (entries: CollectedEntry[]) => {
    if (entries.length === 0) {
      onReject("Nothing was selected. Drop a PBIP project folder or a LookML package .zip file.");
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

  if (slot) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{slot.displayName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {slot.kind === "zip" ? "LookML package (.zip)" : `PBIP project folder · ${slot.fileCount} files`}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Remove source" disabled={disabled} onClick={() => onSelect(null)}>
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
      onClick={() => folderInputRef.current?.click()}
      onDrop={(event) => void handleDrop(event)}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors sm:p-10",
        isDragging ? "border-primary bg-accent" : "border-border",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <FileUp className="mb-3 h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium">Drop a PBIP project folder or a LookML package .zip</p>
      <p className="mt-1 text-xs text-muted-foreground">
        The source type is detected automatically — no need to say which is which.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}>
          <FileUp className="h-3.5 w-3.5" />
          Select PBIP project
        </Button>
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); zipInputRef.current?.click(); }}>
          <FileArchive className="h-3.5 w-3.5" />
          Select LookML package .zip
        </Button>
      </div>
      <input
        ref={folderInputRef}
        type="file"
        data-testid="compare-folder-input"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
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
      <input
        ref={zipInputRef}
        type="file"
        data-testid="compare-zip-input"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        accept=".zip,application/zip"
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) {
            handleEntries([{ relativePath: files[0].name, file: files[0] }]);
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}
