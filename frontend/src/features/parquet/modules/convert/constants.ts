import type { CompressionCodec, CsvDelimiter, CsvQuoting, MappedDataType } from "@/types/parquet";

export const DEFAULT_COMPRESSION: CompressionCodec = "snappy";

export const COMPRESSION_OPTIONS: {
  value: CompressionCodec;
  label: string;
  hint: string;
}[] = [
  { value: "snappy", label: "Snappy", hint: "Fast, splittable — the data lake default" },
  { value: "gzip", label: "Gzip", hint: "Smaller files, slower reads and writes" },
  { value: "brotli", label: "Brotli", hint: "Best compression ratio, slowest" },
  { value: "none", label: "None", hint: "No compression — fastest, largest files" },
];

export const DEFAULT_CSV_DELIMITER: CsvDelimiter = "comma";

export const CSV_DELIMITER_OPTIONS: { value: CsvDelimiter; label: string; hint: string }[] = [
  { value: "comma", label: "Comma", hint: "Standard CSV (,)" },
  { value: "pipe", label: "Pipe", hint: "Pipe-delimited (|)" },
  { value: "tab", label: "Tab", hint: "Tab-separated" },
  { value: "semicolon", label: "Semicolon", hint: "Common in European locales (;)" },
];

export const DEFAULT_CSV_QUOTING: CsvQuoting = "standard";

export const CSV_QUOTING_OPTIONS: { value: CsvQuoting; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "Quote fields only when needed (safe default)" },
  { value: "minimal", label: "Minimal", hint: "Never quote — smaller output, use with caution" },
];

/**
 * Schema & Datatype Mapping (Convert Files). Formats supported by the
 * schema-inspection/override engine today; others fall back to automatic
 * inference only.
 */
export const SCHEMA_MAPPING_SUPPORTED_FORMATS: string[] = ["csv", "tsv"];

export const DATA_TYPE_OPTIONS: { value: MappedDataType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "integer", label: "Integer" },
  { value: "long", label: "Long" },
  { value: "double", label: "Double" },
  { value: "decimal", label: "Decimal" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "timestamp", label: "Timestamp" },
];

export const DATA_TYPE_LABELS: Record<MappedDataType, string> = DATA_TYPE_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {} as Record<MappedDataType, string>
);
