"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/features/parquet/shared/format-bytes";
import { cn } from "@/lib/utils";

/** Drag-and-drop / file-picker for a single `.parquet` file. */
export function ReaderDropZone({
  file,
  disabled,
  onSelect,
  onReject,
}: {
  file: File | null;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
  onReject: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const accept = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".parquet")) {
      onReject(`"${candidate.name}" is not a .parquet file.`);
      return;
    }
    onSelect(candidate);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    accept(event.dataTransfer.files[0]);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{file.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove file"
          disabled={disabled}
          onClick={() => onSelect(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors sm:p-10",
        isDragging ? "border-primary bg-accent" : "border-border",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <FileUp className="mb-3 h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium">Drop a parquet file here</p>
      <p className="mt-1 text-xs text-muted-foreground">Supported: .parquet</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        Select file
      </Button>
      <input
        ref={inputRef}
        type="file"
        data-testid="reader-file-input"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        accept=".parquet"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
