import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useParquetCsvExport } from "@/features/parquet/modules/convert/hooks/use-parquet-csv-export";
import { parquetService } from "@/services/parquet-service";
import { useParquetCsvExportStore } from "@/store/use-parquet-csv-export-store";
import type { ParquetFileMetadata, ParquetToCsvResult, ParquetUploadResult } from "@/types/parquet";

vi.mock("@/services/parquet-service", () => ({
  parquetService: {
    uploadForCsvExport: vi.fn(),
    exportParquetToCsv: vi.fn(),
  },
}));

const MOCK_METADATA: ParquetFileMetadata = {
  file_name: "people.parquet",
  file_size_bytes: 500,
  row_count: 3,
  column_count: 2,
  row_group_count: 1,
  compression: "snappy",
  created_by: "pyarrow",
};

const MOCK_UPLOAD: ParquetUploadResult = {
  file_id: "file-123",
  metadata: MOCK_METADATA,
  columns: [
    { name: "id", data_type: "int64", nullable: false },
    { name: "name", data_type: "string", nullable: true },
  ],
};

const MOCK_RESULT: ParquetToCsvResult = {
  fileName: "people_20260929_120000.csv",
  rowCount: 3,
  columnCount: 2,
  sourceBytes: 500,
  outputBytes: 100,
};

function mockFile(name = "people.parquet") {
  return new File(["parquet-bytes"], name, { type: "application/octet-stream" });
}

beforeEach(() => {
  vi.mocked(parquetService.uploadForCsvExport).mockReset();
  vi.mocked(parquetService.exportParquetToCsv).mockReset();
  useParquetCsvExportStore.getState().reset();
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("useParquetCsvExport", () => {
  it("has no unsaved work before a file is selected", () => {
    const { result } = renderHook(() => useParquetCsvExport());
    expect(result.current.hasUnsavedWork).toBe(false);
  });

  it("flags unsaved work once a file is selected", () => {
    const { result } = renderHook(() => useParquetCsvExport());

    act(() => result.current.selectFile(mockFile()));

    expect(result.current.hasUnsavedWork).toBe(true);
  });

  it("loads preview metadata and schema after validating a file", async () => {
    vi.mocked(parquetService.uploadForCsvExport).mockResolvedValue(MOCK_UPLOAD);

    const { result } = renderHook(() => useParquetCsvExport());
    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.loadPreview());

    await waitFor(() => expect(result.current.fileId).toBe("file-123"));
    expect(result.current.metadata).toEqual(MOCK_METADATA);
    expect(result.current.columns).toHaveLength(2);
  });

  it("surfaces an error when validation fails", async () => {
    vi.mocked(parquetService.uploadForCsvExport).mockRejectedValue(new Error("not a parquet file"));

    const { result } = renderHook(() => useParquetCsvExport());
    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.loadPreview());

    await waitFor(() => expect(result.current.error).toBe("not a parquet file"));
  });

  it("exports CSV with the selected options and clears unsaved work once downloaded", async () => {
    vi.mocked(parquetService.uploadForCsvExport).mockResolvedValue(MOCK_UPLOAD);
    vi.mocked(parquetService.exportParquetToCsv).mockResolvedValue({
      blob: new Blob(["csv-bytes"]),
      result: MOCK_RESULT,
    });

    const { result } = renderHook(() => useParquetCsvExport());
    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.loadPreview());
    act(() => result.current.setDelimiter("pipe"));
    act(() => result.current.setIncludeHeader(false));
    await act(() => result.current.exportCsv());

    await waitFor(() => expect(result.current.result).toEqual(MOCK_RESULT));
    expect(parquetService.exportParquetToCsv).toHaveBeenCalledWith("file-123", {
      delimiter: "pipe",
      includeHeader: false,
      quoting: "standard",
      outputFileName: "",
    });

    act(() => result.current.markDownloaded());
    expect(result.current.hasUnsavedWork).toBe(false);
  });

  it("resets to the initial state", async () => {
    vi.mocked(parquetService.uploadForCsvExport).mockResolvedValue(MOCK_UPLOAD);

    const { result } = renderHook(() => useParquetCsvExport());
    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.loadPreview());

    act(() => result.current.reset());

    expect(result.current.file).toBeNull();
    expect(result.current.fileId).toBeNull();
    expect(result.current.metadata).toBeNull();
  });
});
