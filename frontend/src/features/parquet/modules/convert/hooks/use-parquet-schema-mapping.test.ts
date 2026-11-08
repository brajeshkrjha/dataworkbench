import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useParquetConversion } from "@/features/parquet/modules/convert/hooks/use-parquet-conversion";
import { parquetService } from "@/services/parquet-service";
import { useParquetConversionStore } from "@/store/use-parquet-conversion-store";
import type { SchemaInspectionResult } from "@/types/parquet";

vi.mock("@/services/parquet-service", () => ({
  parquetService: {
    convertToParquet: vi.fn(),
    inspectSchema: vi.fn(),
  },
}));

const MOCK_SCHEMA: SchemaInspectionResult = {
  fileName: "sales.csv",
  rowSampleCount: 3,
  fields: [
    { name: "Customer_ID", detectedType: "string", sampleValues: ["C1", "C2"], nullPercentage: 0 },
    { name: "Amount", detectedType: "double", sampleValues: ["19.99"], nullPercentage: 33.3 },
    { name: "Store_Nbr", detectedType: "integer", sampleValues: ["101"], nullPercentage: 0 },
  ],
  previewRows: [{ Customer_ID: "C1", Amount: 19.99, Store_Nbr: 101 }],
};

function mockFile(name = "sales.csv") {
  return new File(["Customer_ID,Amount,Store_Nbr\nC1,19.99,101"], name, { type: "text/csv" });
}

beforeEach(() => {
  vi.mocked(parquetService.convertToParquet).mockReset();
  vi.mocked(parquetService.inspectSchema).mockReset();
  useParquetConversionStore.getState().reset();
});

describe("schema & datatype mapping (useParquetConversion)", () => {
  it("has no schema until inspectSchema is called", () => {
    const { result } = renderHook(() => useParquetConversion());
    expect(result.current.schema).toBeNull();
  });

  it("loads the detected schema after inspection", async () => {
    vi.mocked(parquetService.inspectSchema).mockResolvedValue(MOCK_SCHEMA);
    const { result } = renderHook(() => useParquetConversion());

    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.inspectSchema());

    await waitFor(() => expect(result.current.schema).toEqual(MOCK_SCHEMA));
    expect(result.current.columnOverrides).toEqual({});
  });

  it("surfaces a schema error without clobbering existing state", async () => {
    vi.mocked(parquetService.inspectSchema).mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useParquetConversion());

    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.inspectSchema());

    await waitFor(() => expect(result.current.schemaError).toBe("boom"));
    expect(result.current.schema).toBeNull();
  });

  it("allows a manual per-column datatype override", async () => {
    vi.mocked(parquetService.inspectSchema).mockResolvedValue(MOCK_SCHEMA);
    const { result } = renderHook(() => useParquetConversion());

    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.inspectSchema());
    await waitFor(() => expect(result.current.schema).toEqual(MOCK_SCHEMA));

    act(() => result.current.setColumnType("Amount", "decimal"));

    expect(result.current.columnOverrides).toEqual({ Amount: "decimal" });
  });

  it("clears an override when set back to the detected type", async () => {
    vi.mocked(parquetService.inspectSchema).mockResolvedValue(MOCK_SCHEMA);
    const { result } = renderHook(() => useParquetConversion());

    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.inspectSchema());
    await waitFor(() => expect(result.current.schema).toEqual(MOCK_SCHEMA));

    act(() => result.current.setColumnType("Amount", "decimal"));
    act(() => result.current.setColumnType("Amount", "double"));

    expect(result.current.columnOverrides).toEqual({});
  });

  it("sets all columns to the same datatype with one bulk action", async () => {
    vi.mocked(parquetService.inspectSchema).mockResolvedValue(MOCK_SCHEMA);
    const { result } = renderHook(() => useParquetConversion());

    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.inspectSchema());
    await waitFor(() => expect(result.current.schema).toEqual(MOCK_SCHEMA));

    act(() => result.current.setAllColumnsTo("string"));

    expect(result.current.columnOverrides).toEqual({
      Customer_ID: "string",
      Amount: "string",
      Store_Nbr: "string",
    });
  });

  it("supports a partial bulk action: set all to string, then override one column", async () => {
    vi.mocked(parquetService.inspectSchema).mockResolvedValue(MOCK_SCHEMA);
    const { result } = renderHook(() => useParquetConversion());

    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.inspectSchema());
    await waitFor(() => expect(result.current.schema).toEqual(MOCK_SCHEMA));

    act(() => result.current.setAllColumnsTo("string"));
    act(() => result.current.setColumnType("Amount", "decimal"));
    act(() => result.current.setColumnType("Store_Nbr", "long"));

    expect(result.current.columnOverrides).toEqual({
      Customer_ID: "string",
      Amount: "decimal",
      Store_Nbr: "long",
    });
  });

  it("clears all overrides on Reset To Auto Detect", async () => {
    vi.mocked(parquetService.inspectSchema).mockResolvedValue(MOCK_SCHEMA);
    const { result } = renderHook(() => useParquetConversion());

    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.inspectSchema());
    await waitFor(() => expect(result.current.schema).toEqual(MOCK_SCHEMA));

    act(() => result.current.setAllColumnsTo("string"));
    act(() => result.current.resetToAutoDetect());

    expect(result.current.columnOverrides).toEqual({});
  });

  it("resets schema and overrides when a new file is selected", async () => {
    vi.mocked(parquetService.inspectSchema).mockResolvedValue(MOCK_SCHEMA);
    const { result } = renderHook(() => useParquetConversion());

    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.inspectSchema());
    await waitFor(() => expect(result.current.schema).toEqual(MOCK_SCHEMA));
    act(() => result.current.setAllColumnsTo("string"));

    act(() => result.current.selectFile(mockFile("other.csv")));

    expect(result.current.schema).toBeNull();
    expect(result.current.columnOverrides).toEqual({});
  });

  it("sends column overrides to convertToParquet as column type payloads", async () => {
    vi.mocked(parquetService.inspectSchema).mockResolvedValue(MOCK_SCHEMA);
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: {
        fileName: "sales.parquet",
        sourceFormat: "csv",
        compression: "snappy",
        rowCount: 1,
        columnCount: 3,
        sourceBytes: 10,
        outputBytes: 50,
        schemaSummary: { decimal: 1, string: 2 },
      },
    });

    const { result } = renderHook(() => useParquetConversion());
    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.inspectSchema());
    await waitFor(() => expect(result.current.schema).toEqual(MOCK_SCHEMA));
    act(() => result.current.setColumnType("Amount", "decimal"));

    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
    await act(() => result.current.convert());

    expect(parquetService.convertToParquet).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        columnTypes: [{ column: "Amount", dataType: "decimal" }],
      })
    );
  });

  it("omits columnTypes entirely when no overrides are set (preserves auto-inference)", async () => {
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: {
        fileName: "sales.parquet",
        sourceFormat: "csv",
        compression: "snappy",
        rowCount: 1,
        columnCount: 3,
        sourceBytes: 10,
        outputBytes: 50,
        schemaSummary: { string: 1, double: 1, integer: 1 },
      },
    });

    const { result } = renderHook(() => useParquetConversion());
    act(() => result.current.selectFile(mockFile()));

    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
    await act(() => result.current.convert());

    expect(parquetService.convertToParquet).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ columnTypes: undefined })
    );
  });
});
