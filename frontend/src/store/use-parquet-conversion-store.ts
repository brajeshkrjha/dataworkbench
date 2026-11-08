"use client";

import { create } from "zustand";

import { DEFAULT_COMPRESSION } from "@/features/parquet/modules/convert/constants";
import {
  AVAILABLE_SOURCE_FORMATS,
  type SourceFormatDefinition,
} from "@/features/parquet/shared/format-registry";
import { parquetService } from "@/services/parquet-service";
import type {
  ColumnTypeOverride,
  CompressionCodec,
  ConversionResult,
  MappedDataType,
  SchemaInspectionResult,
} from "@/types/parquet";

interface ConversionState {
  sourceFormat: SourceFormatDefinition;
  file: File | null;
  compression: CompressionCodec;
  outputFileName: string;
  isConverting: boolean;
  error: string | null;
  result: ConversionResult | null;
  resultBlob: Blob | null;
  downloadUrl: string | null;
  hasDownloaded: boolean;
  // Schema & Datatype Mapping (Convert Files)
  schema: SchemaInspectionResult | null;
  isInspectingSchema: boolean;
  schemaError: string | null;
  columnOverrides: Record<string, MappedDataType>;
}

interface ConversionStore extends ConversionState {
  selectSourceFormat: (sourceFormat: SourceFormatDefinition) => void;
  selectFile: (file: File | null) => void;
  setCompression: (compression: CompressionCodec) => void;
  setOutputFileName: (outputFileName: string) => void;
  setError: (error: string) => void;
  markDownloaded: () => void;
  convert: () => Promise<void>;
  reset: () => void;
  // Schema & Datatype Mapping
  inspectSchema: () => Promise<void>;
  setColumnType: (column: string, dataType: MappedDataType) => void;
  setAllColumnsTo: (dataType: MappedDataType) => void;
  resetToAutoDetect: () => void;
}

const INITIAL_STATE: ConversionState = {
  sourceFormat: AVAILABLE_SOURCE_FORMATS[0],
  file: null,
  compression: DEFAULT_COMPRESSION,
  outputFileName: "",
  isConverting: false,
  error: null,
  result: null,
  resultBlob: null,
  downloadUrl: null,
  hasDownloaded: false,
  schema: null,
  isInspectingSchema: false,
  schemaError: null,
  columnOverrides: {},
};

function revokeUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

/**
 * Module-level (Zustand, not component-local `useState`) conversion state.
 *
 * Root cause of the "conversion disappears after Open in Reader -> Back"
 * bug: this state used to live in `useState` inside the `useParquetConversion`
 * hook, which is only alive while `ConvertModule` is mounted. Next.js App
 * Router unmounts the Convert Files route when navigating to
 * `/tools/parquet-utility/reader`, destroying that state; navigating back
 * remounts the page with a brand-new hook instance (back to
 * `INITIAL_STATE`). A second contributing bug: the hook revoked the
 * download's object URL on every unmount, so even persisted state would
 * have pointed at a dead blob: URL.
 *
 * Moving state into a store means it survives unmount/remount across
 * client-side navigation; the object URL is now only revoked when it's
 * actually superseded (new conversion, new file/format, or explicit
 * reset). Not persisted to storage (Blobs aren't JSON-serializable) — a
 * full page reload intentionally starts fresh, which matches the "browser
 * session ends" allowance.
 */
export const useParquetConversionStore = create<ConversionStore>()((set, get) => ({
  ...INITIAL_STATE,

  selectSourceFormat: (sourceFormat) => {
    revokeUrl(get().downloadUrl);
    set({
      sourceFormat,
      file: null,
      error: null,
      result: null,
      resultBlob: null,
      downloadUrl: null,
      hasDownloaded: false,
      schema: null,
      schemaError: null,
      columnOverrides: {},
    });
  },

  selectFile: (file) => {
    revokeUrl(get().downloadUrl);
    set({
      file,
      error: null,
      result: null,
      resultBlob: null,
      downloadUrl: null,
      hasDownloaded: false,
      schema: null,
      schemaError: null,
      columnOverrides: {},
    });
  },

  setCompression: (compression) => set({ compression }),

  setOutputFileName: (outputFileName) => set({ outputFileName }),

  setError: (error) => set({ error, result: null }),

  markDownloaded: () => set({ hasDownloaded: true }),

  reset: () => {
    revokeUrl(get().downloadUrl);
    set(INITIAL_STATE);
  },

  convert: async () => {
    const { file, compression, outputFileName, columnOverrides } = get();
    if (!file) return;

    revokeUrl(get().downloadUrl);
    set({
      isConverting: true,
      error: null,
      result: null,
      resultBlob: null,
      downloadUrl: null,
      hasDownloaded: false,
    });

    const columnTypes: ColumnTypeOverride[] = Object.entries(columnOverrides).map(
      ([column, dataType]) => ({ column, dataType })
    );

    try {
      const { blob, result } = await parquetService.convertToParquet(file, {
        compression,
        outputFileName,
        columnTypes: columnTypes.length ? columnTypes : undefined,
      });
      const url = URL.createObjectURL(blob);
      set({
        isConverting: false,
        result,
        resultBlob: blob,
        downloadUrl: url,
      });
    } catch (err) {
      set({
        isConverting: false,
        error: err instanceof Error ? err.message : "Conversion failed.",
      });
    }
  },

  // ---- Schema & Datatype Mapping (Convert Files) ----

  inspectSchema: async () => {
    const { file } = get();
    if (!file) return;

    set({ isInspectingSchema: true, schemaError: null });
    try {
      const schema = await parquetService.inspectSchema(file);
      set({ isInspectingSchema: false, schema, columnOverrides: {} });
    } catch (err) {
      set({
        isInspectingSchema: false,
        schema: null,
        schemaError: err instanceof Error ? err.message : "Schema inspection failed.",
      });
    }
  },

  setColumnType: (column, dataType) => {
    const { schema, columnOverrides } = get();
    const detected = schema?.fields.find((field) => field.name === column)?.detectedType;
    const next = { ...columnOverrides };
    if (detected === dataType) {
      delete next[column];
    } else {
      next[column] = dataType;
    }
    set({ columnOverrides: next });
  },

  setAllColumnsTo: (dataType) => {
    const { schema } = get();
    if (!schema) return;
    const next: Record<string, MappedDataType> = {};
    for (const field of schema.fields) {
      next[field.name] = dataType;
    }
    set({ columnOverrides: next });
  },

  resetToAutoDetect: () => set({ columnOverrides: {} }),
}));
