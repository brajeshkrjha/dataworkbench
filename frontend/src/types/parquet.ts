/**
 * Types for the Parquet Utility tool.
 *
 * `CompressionCodec` is derived from the generated OpenAPI schema.
 * `SourceFormat`/`ConversionResult` mirror `backend/app/schemas/parquet.py`;
 * they are returned as `X-Conversion-*` response headers alongside the
 * binary download, which OpenAPI cannot express as a schema reference.
 */
import type { components } from "@/types/generated/api";

export type CompressionCodec = components["schemas"]["CompressionCodec"];

export type SourceFormat = "csv" | "tsv" | "json" | "excel" | "xml" | "avro" | "orc";

export interface ConversionResult {
  fileName: string;
  sourceFormat: SourceFormat;
  compression: CompressionCodec;
  rowCount: number;
  columnCount: number;
  sourceBytes: number;
  outputBytes: number;
  schemaSummary: Record<string, number>;
}

export interface ConversionOptions {
  compression: CompressionCodec;
  outputFileName?: string;
  columnTypes?: ColumnTypeOverride[];
}

export interface ConvertedFile {
  result: ConversionResult;
  blob: Blob;
}

/**
 * Schema & Datatype Mapping (Convert Files) - mirrors
 * `backend/app/schemas/parquet.py`'s `MappedDataType`/`SchemaFieldInfo`/
 * `SchemaInspectionResult`/`ColumnTypeOverride`. A format-agnostic engine:
 * currently backs CSV/TSV, designed to extend to Excel/XML later without
 * changing these shapes.
 */
export type MappedDataType =
  | "string"
  | "integer"
  | "long"
  | "double"
  | "decimal"
  | "boolean"
  | "date"
  | "timestamp";

export interface SchemaFieldInfo {
  name: string;
  detectedType: MappedDataType;
  sampleValues: string[];
  nullPercentage: number;
}

export interface SchemaInspectionResult {
  fileName: string;
  rowSampleCount: number;
  fields: SchemaFieldInfo[];
  previewRows: Record<string, unknown>[];
}

export interface ColumnTypeOverride {
  column: string;
  dataType: MappedDataType;
}

/**
 * Parquet -> CSV export types ("From Parquet" direction, Convert Files).
 * `CsvDelimiter`/`CsvQuoting` are generated from the OpenAPI schema;
 * `ParquetToCsvResult` mirrors `backend/app/schemas/parquet.py` the same
 * way `ConversionResult` does (returned as `X-Conversion-*` headers
 * alongside the binary download).
 */
export type CsvDelimiter = components["schemas"]["CsvDelimiter"];
export type CsvQuoting = components["schemas"]["CsvQuoting"];

export interface ParquetToCsvResult {
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceBytes: number;
  outputBytes: number;
}

export interface CsvExportOptions {
  delimiter: CsvDelimiter;
  includeHeader: boolean;
  quoting: CsvQuoting;
  outputFileName?: string;
}

export interface ConvertedCsvFile {
  result: ParquetToCsvResult;
  blob: Blob;
}

/**
 * Parquet Reader types — mirror `backend/app/schemas/parquet.py`'s reader
 * schemas 1:1, so these are generated straight from the OpenAPI schema
 * rather than hand-duplicated.
 */
export type ColumnSchema = components["schemas"]["ColumnSchema"];
export type ParquetFileMetadata = components["schemas"]["ParquetFileMetadata"];
export type ParquetRowPage = components["schemas"]["ParquetRowPage"];
export type ParquetUploadResult = components["schemas"]["ParquetUploadResult"];

/**
 * Parquet Analyzer types — mirror `backend/app/schemas/parquet.py`'s
 * analyzer schemas 1:1 (Overview/Schema/Statistics/Profiling/Sampling/
 * Storage tabs, all backed by one uploaded-file session).
 */
export type ColumnStatistics = components["schemas"]["ColumnStatistics"];
export type ParquetStatistics = components["schemas"]["ParquetStatistics"];
export type CommonValue = components["schemas"]["CommonValue"];
export type ColumnProfile = components["schemas"]["ColumnProfile"];
export type SampleMode = components["schemas"]["SampleMode"];
export type ParquetSample = components["schemas"]["ParquetSample"];
export type RowGroupStorage = components["schemas"]["RowGroupStorage"];
export type ColumnStorage = components["schemas"]["ColumnStorage"];
export type StorageAnalysis = components["schemas"]["StorageAnalysis"];

/**
 * Schema Comparison types — mirror `backend/app/schemas/parquet.py`'s
 * comparison schemas 1:1 (stateless: one request in, one full result out).
 */
export type SchemaDiffType = components["schemas"]["SchemaDiffType"];
export type RiskLevel = components["schemas"]["RiskLevel"];
export type SchemaHealth = components["schemas"]["SchemaHealth"];
export type ColumnDiff = components["schemas"]["ColumnDiff"];
export type ComparisonSummary = components["schemas"]["app__schemas__parquet__ComparisonSummary"];
export type SchemaDriftAnalysis = components["schemas"]["SchemaDriftAnalysis"];
export type SchemaComparisonResult = components["schemas"]["SchemaComparisonResult"];
export type ComparisonExportFormat = components["schemas"]["ComparisonExportFormat"];

