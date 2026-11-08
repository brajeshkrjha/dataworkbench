import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/features/parquet/shared/format-bytes";
import type { ParquetFileMetadata } from "@/types/parquet";

/** File A vs File B at a glance - shown as soon as the compare completes,
 * before any column-level detail. */
export function FileMetadataRow({ fileA, fileB }: { fileA: ParquetFileMetadata; fileB: ParquetFileMetadata }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FileCard label="File A" metadata={fileA} />
      <FileCard label="File B" metadata={fileB} />
    </div>
  );
}

function FileCard({ label, metadata }: { label: string; metadata: ParquetFileMetadata }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{label}</span>
          <span className="truncate font-mono text-xs font-normal text-muted-foreground">{metadata.file_name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Size" value={formatBytes(metadata.file_size_bytes)} />
          <Stat label="Rows" value={metadata.row_count.toLocaleString()} />
          <Stat label="Columns" value={metadata.column_count.toLocaleString()} />
          <Stat label="Compression" value={metadata.compression ?? "Unknown"} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-mono text-sm">{value}</p>
    </div>
  );
}
