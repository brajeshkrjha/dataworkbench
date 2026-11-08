/**
 * Source format registry, shared across Parquet Utility modules that
 * accept file input (today: Convert Files). Adding a future input
 * format only requires a new entry here.
 */
export type SourceFormatStatus = "available" | "planned";

export interface SourceFormatDefinition {
  id: string;
  label: string;
  description: string;
  extensions: string[];
  icon: string;
  status: SourceFormatStatus;
}

export const SOURCE_FORMATS: SourceFormatDefinition[] = [
  {
    id: "csv",
    label: "CSV",
    description: "Comma-separated values",
    extensions: ["csv"],
    icon: "FileCode2",
    status: "available",
  },
  {
    id: "json",
    label: "JSON",
    description: "JSON array or newline-delimited JSON",
    extensions: ["json", "ndjson", "jsonl"],
    icon: "Braces",
    status: "available",
  },
  {
    id: "excel",
    label: "Excel",
    description: "XLSX workbooks",
    extensions: ["xlsx", "xls"],
    icon: "Table",
    status: "available",
  },
  {
    id: "tsv",
    label: "TSV",
    description: "Tab-separated values",
    extensions: ["tsv"],
    icon: "FileCode",
    status: "available",
  },
  {
    id: "xml",
    label: "XML",
    description: "XML documents",
    extensions: ["xml"],
    icon: "FileTerminal",
    status: "available",
  },
  {
    id: "avro",
    label: "Avro",
    description: "Apache Avro files",
    extensions: ["avro"],
    icon: "Database",
    status: "available",
  },
  {
    id: "orc",
    label: "ORC",
    description: "Apache ORC files",
    extensions: ["orc"],
    icon: "Database",
    status: "available",
  },
];

export const AVAILABLE_SOURCE_FORMATS = SOURCE_FORMATS.filter(
  (format) => format.status === "available"
);

export function acceptAttributeFor(format: SourceFormatDefinition): string {
  return format.extensions.map((extension) => `.${extension}`).join(",");
}

export function matchesFormat(fileName: string, format: SourceFormatDefinition): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return format.extensions.includes(extension);
}
