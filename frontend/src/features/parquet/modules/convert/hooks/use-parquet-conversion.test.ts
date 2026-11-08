import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useParquetConversion } from "@/features/parquet/modules/convert/hooks/use-parquet-conversion";
import { parquetService } from "@/services/parquet-service";
import { useParquetConversionStore } from "@/store/use-parquet-conversion-store";
import type { ConversionResult } from "@/types/parquet";

vi.mock("@/services/parquet-service", () => ({
  parquetService: {
    convertToParquet: vi.fn(),
  },
}));

const MOCK_RESULT: ConversionResult = {
  fileName: "people_20260929_120000.parquet",
  sourceFormat: "csv",
  compression: "snappy",
  rowCount: 2,
  columnCount: 2,
  sourceBytes: 20,
  outputBytes: 200,
  schemaSummary: { string: 1, integer: 1 },
};

function mockFile(name = "people.csv") {
  return new File(["id,name\n1,alice"], name, { type: "text/csv" });
}

beforeEach(() => {
  vi.mocked(parquetService.convertToParquet).mockReset();
  useParquetConversionStore.getState().reset();
  // jsdom does not implement createObjectURL/revokeObjectURL.
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("useParquetConversion", () => {
  it("has no unsaved work before a file is selected", () => {
    const { result } = renderHook(() => useParquetConversion());
    expect(result.current.hasUnsavedWork).toBe(false);
  });

  it("flags unsaved work once a file is selected but not converted", () => {
    const { result } = renderHook(() => useParquetConversion());

    act(() => result.current.selectFile(mockFile()));

    expect(result.current.hasUnsavedWork).toBe(true);
  });

  it("marks the result present and still unsaved after a successful conversion (not yet downloaded)", async () => {
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: MOCK_RESULT,
    });

    const { result } = renderHook(() => useParquetConversion());
    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.convert());

    await waitFor(() => expect(result.current.result).toEqual(MOCK_RESULT));
    expect(result.current.hasUnsavedWork).toBe(true);
  });

  it("clears unsaved work once the file is marked as downloaded", async () => {
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: MOCK_RESULT,
    });

    const { result } = renderHook(() => useParquetConversion());
    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.convert());
    await waitFor(() => expect(result.current.result).toEqual(MOCK_RESULT));

    act(() => result.current.markDownloaded());

    expect(result.current.hasUnsavedWork).toBe(false);
  });

  it("clears the completed result and re-flags unsaved work when a new file is selected", async () => {
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: MOCK_RESULT,
    });

    const { result } = renderHook(() => useParquetConversion());
    act(() => result.current.selectFile(mockFile("first.csv")));
    await act(() => result.current.convert());
    await waitFor(() => expect(result.current.result).toEqual(MOCK_RESULT));
    act(() => result.current.markDownloaded());
    expect(result.current.hasUnsavedWork).toBe(false);

    act(() => result.current.selectFile(mockFile("second.csv")));

    expect(result.current.result).toBeNull();
    expect(result.current.hasUnsavedWork).toBe(true);
  });

  it("does not re-enable a completed conversion when only an option changes", async () => {
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: MOCK_RESULT,
    });

    const { result } = renderHook(() => useParquetConversion());
    act(() => result.current.selectFile(mockFile()));
    await act(() => result.current.convert());
    await waitFor(() => expect(result.current.result).toEqual(MOCK_RESULT));

    act(() => result.current.setCompression("gzip"));

    // Result (and therefore the "completed" state a caller derives from it)
    // is untouched by option changes alone.
    expect(result.current.result).toEqual(MOCK_RESULT);
  });
});
