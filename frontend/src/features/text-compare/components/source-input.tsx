"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes } from "@/features/parquet/shared/format-bytes";
import { cn } from "@/lib/utils";

/** One side (A or B) of the comparison: switch between uploading a file
 * and pasting raw text. Mixing methods across sides is fully supported
 * since each `SourceInput` is independent. */
export function SourceInput({
  label,
  file,
  text,
  disabled,
  onSelectFile,
  onChangeText,
}: {
  label: string;
  file: File | null;
  text: string;
  disabled?: boolean;
  onSelectFile: (file: File | null) => void;
  onChangeText: (text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const candidate = event.dataTransfer.files[0];
    if (candidate) onSelectFile(candidate);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <Tabs defaultValue={file ? "upload" : "paste"} className="flex flex-col gap-2">
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="paste">Paste</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          {file ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">{file.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Remove file" disabled={disabled} onClick={() => onSelectFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-border",
                disabled && "pointer-events-none opacity-50"
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                if (!disabled) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <FileUp className="h-6 w-6" />
              <p>Drag & drop a file, or click to browse</p>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                disabled={disabled}
                onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="paste">
          <textarea
            className="min-h-[160px] w-full rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Paste content here..."
            value={text}
            disabled={disabled}
            onChange={(event) => onChangeText(event.target.value)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
