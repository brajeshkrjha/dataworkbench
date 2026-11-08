import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBulkConversion } from "@/features/looker/modules/convert/hooks/use-bulk-conversion";
import { buildProjectZip } from "@/features/looker/shared/project-zip";
import { lookerService } from "@/services/looker-service";
import type { BulkJobStartResult, BulkJobStatusResult, BulkJobSummaryResult } from "@/types/looker";

vi.mock("@/features/looker/shared/project-zip", () => ({ buildProjectZip: vi.fn() }));
vi.mock("@/services/looker-service", () => ({
  lookerService: {
    startBulkConvert: vi.fn(), getBulkConvertStatus: vi.fn(), getBulkConvertSummary: vi.fn(),
  },
}));

const STARTED: BulkJobStartResult = {
  job_id: "job-1", discovery: { found: 1, valid: 1, invalid: 0, invalid_projects: [] },
};
const PROCESSING: BulkJobStatusResult = {
  job_id: "job-1", status: "processing", total: 1, processed: 0, current_project: "Sales", percent: 0,
};
const SUMMARY: BulkJobSummaryResult = {
  job_id: "job-1", status: "completed", discovery: STARTED.discovery,
  processed: 1, successful: 1, failed: 0, failures: [],
  successes: [{ project_name: "Sales", views_generated: 1, explores_generated: 1 }],
};
const ENTRIES = [{ file: new File(["{}"], "Sales.pbip"), relativePath: "Sales/Sales.pbip" }];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.mocked(buildProjectZip).mockResolvedValue(new Blob(["zip"]));
  vi.mocked(lookerService.startBulkConvert).mockResolvedValue(STARTED);
  vi.mocked(lookerService.getBulkConvertStatus).mockResolvedValue(PROCESSING);
  vi.mocked(lookerService.getBulkConvertSummary).mockResolvedValue(SUMMARY);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup() {
  const hook = renderHook(() => useBulkConversion());
  act(() => hook.result.current.selectEntries(ENTRIES));
  return hook;
}

describe("useBulkConversion lifecycle", () => {
  it("polls at the existing interval and stops after fetching the final summary", async () => {
    const { result } = setup();
    await act(() => result.current.start());
    expect(result.current.isProcessing).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    vi.mocked(lookerService.getBulkConvertStatus).mockResolvedValue({ ...PROCESSING, status: "completed", processed: 1, percent: 100 });
    await act(() => vi.advanceTimersByTimeAsync(700));
    expect(result.current.summary).toEqual(SUMMARY);
    expect(lookerService.getBulkConvertStatus).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels scheduled polling when the module unmounts", async () => {
    const { result, unmount } = setup();
    await act(() => result.current.start());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1400);
    expect(lookerService.getBulkConvertStatus).toHaveBeenCalledTimes(1);
  });

  it.each(["reset", "unmount"] as const)("does not restart polling after an in-flight response resolves following %s", async (action) => {
    const pending = deferred<BulkJobStatusResult>();
    vi.mocked(lookerService.getBulkConvertStatus).mockReturnValue(pending.promise);
    const { result, unmount } = setup();
    await act(() => result.current.start());
    if (action === "reset") act(() => result.current.reset());
    else unmount();

    await act(async () => pending.resolve(PROCESSING));
    expect(vi.getTimerCount()).toBe(0);
    expect(lookerService.getBulkConvertSummary).not.toHaveBeenCalled();
    if (action === "reset") expect(result.current.status).toBeNull();
  });

  it("ignores an old summary after a different folder is selected", async () => {
    const pending = deferred<BulkJobSummaryResult>();
    vi.mocked(lookerService.getBulkConvertStatus).mockResolvedValue({ ...PROCESSING, status: "completed" });
    vi.mocked(lookerService.getBulkConvertSummary).mockReturnValue(pending.promise);
    const { result } = setup();
    await act(() => result.current.start());
    act(() => result.current.selectEntries(ENTRIES));
    await act(async () => pending.resolve(SUMMARY));
    expect(result.current.summary).toBeNull();
    expect(result.current.jobId).toBeNull();
  });

  it("ignores stale startup failures after reset", async () => {
    const pending = deferred<BulkJobStartResult>();
    vi.mocked(lookerService.startBulkConvert).mockReturnValue(pending.promise);
    const { result } = setup();
    let start!: Promise<void>;
    await act(async () => { start = result.current.start(); });
    act(() => result.current.reset());
    await act(async () => { pending.reject(new Error("Old failure")); await start; });
    expect(result.current.error).toBeNull();
    expect(result.current.isUploading).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not submit duplicate starts in the same event", async () => {
    const { result } = setup();
    await act(async () => { await Promise.all([result.current.start(), result.current.start()]); });
    expect(lookerService.startBulkConvert).toHaveBeenCalledTimes(1);
  });
});