/**
 * Service layer for the Parquet Utility API. All parquet-related
 * network access goes through this module; future Parquet Utility
 * modules add their calls here.
 */
import { apiGet, apiPostForm, apiPostFormForBlob, apiPostJsonForBlob } from "@/services/api-client";
import type {
  ColumnProfile,
  ColumnSchema,
  ComparisonExportFormat,
  CompressionCodec,
  ConversionOptions,
  ConversionResult,
  ConvertedCsvFile,
  ConvertedFile,
  CsvExportOptions,
  MappedDataType,
  ParquetFileMetadata,
  ParquetRowPage,
  ParquetSample,
  ParquetStatistics,
  ParquetToCsvResult,
  ParquetUploadResult,
  SampleMode,
  SchemaComparisonResult,
  SchemaInspectionResult,
  SourceFormat,
  StorageAnalysis,
} from "@/types/parquet";

const BASE_PATH = "/tools/parquet-utility";

function readResultHeaders(headers: Headers, fallbackName: string): ConversionResult {
  let schemaSummary: Record<string, number> = {};
  const raw = headers.get("X-Conversion-Schema-Summary");
  if (raw) {
    try {
      schemaSummary = JSON.parse(raw) as Record<string, number>;
    } catch {
      schemaSummary = {};
    }
  }
  return {
    fileName: headers.get("X-Conversion-File-Name") ?? fallbackName,
    sourceFormat: (headers.get("X-Conversion-Source-Format") ?? "csv") as SourceFormat,
    compression: (headers.get("X-Conversion-Compression") ?? "snappy") as CompressionCodec,
    rowCount: Number(headers.get("X-Conversion-Row-Count") ?? 0),
    columnCount: Number(headers.get("X-Conversion-Column-Count") ?? 0),
    sourceBytes: Number(headers.get("X-Conversion-Source-Bytes") ?? 0),
    outputBytes: Number(headers.get("X-Conversion-Output-Bytes") ?? 0),
    schemaSummary,
  };
}

function readCsvResultHeaders(headers: Headers, fallbackName: string): ParquetToCsvResult {
  return {
    fileName: headers.get("X-Conversion-File-Name") ?? fallbackName,
    rowCount: Number(headers.get("X-Conversion-Row-Count") ?? 0),
    columnCount: Number(headers.get("X-Conversion-Column-Count") ?? 0),
    sourceBytes: Number(headers.get("X-Conversion-Source-Bytes") ?? 0),
    outputBytes: Number(headers.get("X-Conversion-Output-Bytes") ?? 0),
  };
}

export const parquetService = {
  async convertToParquet(file: File, options: ConversionOptions): Promise<ConvertedFile> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("compression", options.compression);
    if (options.outputFileName?.trim()) {
      formData.append("output_file_name", options.outputFileName.trim());
    }
    if (options.columnTypes?.length) {
      const payload = options.columnTypes.map((override) => ({
        column: override.column,
        data_type: override.dataType,
      }));
      formData.append("column_types", JSON.stringify(payload));
    }

    const { blob, headers } = await apiPostFormForBlob(`${BASE_PATH}/convert`, formData);
    return { blob, result: readResultHeaders(headers, `${file.name}.parquet`) };
  },

  /**
   * Schema & Datatype Mapping (Convert Files) - samples the uploaded file
   * and reports auto-detected per-column datatypes, example values, and
   * null rates, so the UI can show them before conversion and let users
   * override individual columns. Currently backed for CSV/TSV.
   */
  async inspectSchema(file: File): Promise<SchemaInspectionResult> {
    const formData = new FormData();
    formData.append("file", file);
    const raw = await apiPostForm<{
      file_name: string;
      row_sample_count: number;
      fields: { name: string; detected_type: MappedDataType; sample_values: string[]; null_percentage: number }[];
      preview_rows: Record<string, unknown>[];
    }>(`${BASE_PATH}/convert/inspect`, formData);

    return {
      fileName: raw.file_name,
      rowSampleCount: raw.row_sample_count,
      fields: raw.fields.map((field) => ({
        name: field.name,
        detectedType: field.detected_type,
        sampleValues: field.sample_values,
        nullPercentage: field.null_percentage,
      })),
      previewRows: raw.preview_rows,
    };
  },

  /**
   * Parquet -> CSV export ("From Parquet" direction). Two-step like
   * Parquet Reader/Analyzer: upload once to get a `file_id` + preview
   * metadata/schema, then export with the chosen CSV options. The
   * `file_id` is from the same backend session store as Parquet Reader,
   * so it can also be used to preview rows (`getReaderRows`) or opened
   * directly in Parquet Reader without re-uploading.
   */
  async uploadForCsvExport(file: File): Promise<ParquetUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    return apiPostForm<ParquetUploadResult>(`${BASE_PATH}/convert/from-parquet/upload`, formData);
  },

  async exportParquetToCsv(fileId: string, options: CsvExportOptions): Promise<ConvertedCsvFile> {
    const formData = new FormData();
    formData.append("delimiter", options.delimiter);
    formData.append("include_header", String(options.includeHeader));
    formData.append("quoting", options.quoting);
    if (options.outputFileName?.trim()) {
      formData.append("output_file_name", options.outputFileName.trim());
    }

    const { blob, headers } = await apiPostFormForBlob(
      `${BASE_PATH}/convert/from-parquet/${fileId}/export`,
      formData
    );
    return { blob, result: readCsvResultHeaders(headers, "export.csv") };
  },

  async uploadForReading(file: File): Promise<ParquetUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    return apiPostForm<ParquetUploadResult>(`${BASE_PATH}/reader/upload`, formData);
  },

  async getReaderMetadata(fileId: string): Promise<ParquetFileMetadata> {
    return apiGet<ParquetFileMetadata>(`${BASE_PATH}/reader/${fileId}/metadata`);
  },

  async getReaderSchema(fileId: string): Promise<ColumnSchema[]> {
    return apiGet<ColumnSchema[]>(`${BASE_PATH}/reader/${fileId}/schema`);
  },

  async getReaderRows(fileId: string, offset: number, limit: number): Promise<ParquetRowPage> {
    return apiGet<ParquetRowPage>(
      `${BASE_PATH}/reader/${fileId}/rows?offset=${offset}&limit=${limit}`
    );
  },

  /**
   * Parquet Analyzer — a single-file inspection workspace. Uploads its own
   * session (separate from Read Parquet's) but the backend reuses the same
   * validated-parquet-session machinery under the hood.
   */
  async uploadForAnalysis(file: File): Promise<ParquetUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    return apiPostForm<ParquetUploadResult>(`${BASE_PATH}/analyzer/upload`, formData);
  },

  async getAnalyzerOverview(fileId: string): Promise<ParquetFileMetadata> {
    return apiGet<ParquetFileMetadata>(`${BASE_PATH}/analyzer/${fileId}/overview`);
  },

  async getAnalyzerSchema(fileId: string): Promise<ColumnSchema[]> {
    return apiGet<ColumnSchema[]>(`${BASE_PATH}/analyzer/${fileId}/schema`);
  },

  async getAnalyzerStatistics(fileId: string): Promise<ParquetStatistics> {
    return apiGet<ParquetStatistics>(`${BASE_PATH}/analyzer/${fileId}/statistics`);
  },

  async getAnalyzerColumnProfile(fileId: string, columnName: string): Promise<ColumnProfile> {
    return apiGet<ColumnProfile>(
      `${BASE_PATH}/analyzer/${fileId}/columns/${encodeURIComponent(columnName)}/profile`
    );
  },

  async getAnalyzerSample(fileId: string, mode: SampleMode, size: number): Promise<ParquetSample> {
    return apiGet<ParquetSample>(
      `${BASE_PATH}/analyzer/${fileId}/sample?mode=${mode}&size=${size}`
    );
  },

  async getAnalyzerStorage(fileId: string): Promise<StorageAnalysis> {
    return apiGet<StorageAnalysis>(`${BASE_PATH}/analyzer/${fileId}/storage`);
  },

  /**
   * Schema Comparison — stateless: both files go in one request, a full
   * diff result comes back. No file_id/session is kept server-side.
   */
  async compareSchemas(
    fileA: File,
    fileB: File,
    includeOrderChanges: boolean
  ): Promise<SchemaComparisonResult> {
    const formData = new FormData();
    formData.append("file_a", fileA);
    formData.append("file_b", fileB);
    formData.append("include_order_changes", String(includeOrderChanges));
    return apiPostForm<SchemaComparisonResult>(`${BASE_PATH}/comparison/compare`, formData);
  },

  async exportComparisonReport(
    result: SchemaComparisonResult,
    format: ComparisonExportFormat
  ): Promise<Blob> {
    return apiPostJsonForBlob(`${BASE_PATH}/comparison/export?format=${format}`, result);
  },
};
