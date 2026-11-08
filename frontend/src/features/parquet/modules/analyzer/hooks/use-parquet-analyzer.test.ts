import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useParquetAnalyzer } from "@/features/parquet/modules/analyzer/hooks/use-parquet-analyzer";
import { parquetService } from "@/services/parquet-service";
import type { ColumnProfile, ParquetSample, ParquetStatistics, ParquetUploadResult } from "@/types/parquet";

vi.mock("@/services/parquet-service", () => ({
  parquetService: { uploadForAnalysis: vi.fn(), getAnalyzerStatistics: vi.fn(), getAnalyzerColumnProfile: vi.fn(), getAnalyzerSample: vi.fn() },
}));

const UPLOAD: ParquetUploadResult = {
  file_id: "file-1",
  metadata: { file_name: "data.parquet", file_size_bytes: 100, row_count: 1, column_count: 1, row_group_count: 1 },
  columns: [{ name: "id", data_type: "int64", nullable: false }],
};
const STATISTICS: ParquetStatistics = { row_count: 1, column_count: 1, columns: [] };
const PROFILE: ColumnProfile = { name: "id", data_type: "int64", null_count: 0, null_percentage: 0, distinct_count: 1, cardinality_ratio: 1, most_common_values: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(parquetService.uploadForAnalysis).mockResolvedValue(UPLOAD);
});

async function setup() {
  const hook = renderHook(() => useParquetAnalyzer());
  act(() => hook.result.current.selectFile(new File(["parquet"], "data.parquet")));
  await act(() => hook.result.current.upload());
  return hook;
}

describe("useParquetAnalyzer request lifecycle", () => {
  it("deduplicates in-flight tab loads and reuses the successful result", async () => {
    const pending = deferred<ParquetStatistics>();
    vi.mocked(parquetService.getAnalyzerStatistics).mockReturnValue(pending.promise);
    const { result } = await setup();
    let first!: Promise<void>;
    act(() => { first = result.current.loadStatistics(); void result.current.loadStatistics(); });
    expect(parquetService.getAnalyzerStatistics).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(STATISTICS); await first; });
    await act(() => result.current.loadStatistics());
    expect(parquetService.getAnalyzerStatistics).toHaveBeenCalledTimes(1);
    expect(result.current.statistics).toEqual(STATISTICS);
  });

  it("does not restore a result after the workspace is reset", async () => {
    const pending = deferred<ParquetStatistics>();
    vi.mocked(parquetService.getAnalyzerStatistics).mockReturnValue(pending.promise);
    const { result } = await setup();
    let request!: Promise<void>;
    act(() => { request = result.current.loadStatistics(); });
    act(() => result.current.reset());
    await act(async () => { pending.resolve(STATISTICS); await request; });
    expect(result.current.statistics).toBeNull();
    expect(result.current.hasResult).toBe(false);
  });

  it("does not restore an upload after reset", async () => {
    const pending = deferred<ParquetUploadResult>();
    vi.mocked(parquetService.uploadForAnalysis).mockReturnValue(pending.promise);
    const { result } = renderHook(() => useParquetAnalyzer());
    act(() => result.current.selectFile(new File(["parquet"], "data.parquet")));
    let request!: Promise<void>;
    act(() => { request = result.current.upload(); });
    act(() => result.current.reset());
    await act(async () => { pending.resolve(UPLOAD); await request; });
    expect(result.current.fileId).toBeNull();
    expect(result.current.isUploading).toBe(false);
  });

  it("keeps the latest selected column when profiles resolve out of order", async () => {
    const pending = deferred<ColumnProfile>();
    vi.mocked(parquetService.getAnalyzerColumnProfile).mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ ...PROFILE, name: "new" });
    const { result } = await setup();
    let first!: Promise<void>;
    act(() => { first = result.current.selectColumn("old"); });
    await act(() => result.current.selectColumn("new"));
    await act(async () => { pending.resolve({ ...PROFILE, name: "old" }); await first; });
    expect(result.current.selectedColumn).toBe("new");
    expect(result.current.profile?.name).toBe("new");
  });

  it("keeps the latest sample when requests resolve out of order", async () => {
    const pending = deferred<ParquetSample>();
    const sample: ParquetSample = { mode: "random", sample_size: 1, rows: [{ id: 2 }] };
    vi.mocked(parquetService.getAnalyzerSample).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(sample);
    const { result } = await setup();
    let first!: Promise<void>;
    act(() => { first = result.current.loadSample("first", 1); });
    await act(() => result.current.loadSample("random", 1));
    await act(async () => { pending.resolve({ ...sample, mode: "first", rows: [{ id: 1 }] }); await first; });
    expect(result.current.sample).toEqual(sample);
  });
});