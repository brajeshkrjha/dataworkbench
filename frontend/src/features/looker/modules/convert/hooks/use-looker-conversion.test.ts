import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CollectedEntry } from "@/features/looker/shared/project-collector";
import { useLookerConversion } from "@/features/looker/modules/convert/hooks/use-looker-conversion";
import { lookerService } from "@/services/looker-service";
import type { LookerConversionResult } from "@/types/looker";

vi.mock("@/services/looker-service", () => ({
  lookerService: {
    convertPbipToLookml: vi.fn(),
  },
}));

const MOCK_RESULT: LookerConversionResult = {
  projectName: "Sales",
  outputFileName: "Sales_LookML_2026-09-29_1200.zip",
  viewsGenerated: 4,
  exploresGenerated: 1,
  relationshipsFound: 3,
  measuresFound: 5,
};

function makeFile(name: string, content = "content") {
  return new File([content], name);
}

function validProjectEntries(): CollectedEntry[] {
  return [
    { relativePath: "Sales/Sales.pbip", file: makeFile("Sales.pbip") },
    { relativePath: "Sales/Sales.Report/report.json", file: makeFile("report.json") },
    { relativePath: "Sales/Sales.SemanticModel/model.tmdl", file: makeFile("model.tmdl") },
  ];
}

function incompleteProjectEntries(): CollectedEntry[] {
  return [{ relativePath: "Sales/Sales.pbip", file: makeFile("Sales.pbip") }];
}

beforeEach(() => {
  vi.mocked(lookerService.convertPbipToLookml).mockReset();
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("useLookerConversion", () => {
  it("has no unsaved work before a project is selected", () => {
    const { result } = renderHook(() => useLookerConversion());
    expect(result.current.hasUnsavedWork).toBe(false);
  });

  it("flags unsaved work once a project is selected", () => {
    const { result } = renderHook(() => useLookerConversion());
    act(() => result.current.selectEntries(validProjectEntries()));
    expect(result.current.hasUnsavedWork).toBe(true);
  });

  it("validates the project synchronously from the selected entries", () => {
    const { result } = renderHook(() => useLookerConversion());
    act(() => result.current.selectEntries(validProjectEntries()));
    expect(result.current.validation.status).toBe("valid");
    expect(result.current.project?.displayName).toBe("Sales.pbip");
  });

  it("marks the project invalid when required assets are missing", () => {
    const { result } = renderHook(() => useLookerConversion());
    act(() => result.current.selectEntries(incompleteProjectEntries()));
    expect(result.current.validation.status).toBe("invalid");
    expect(result.current.validation.hasReportFolder).toBe(false);
  });

  it("does not run conversion when validation fails", async () => {
    const { result } = renderHook(() => useLookerConversion());
    act(() => result.current.selectEntries(incompleteProjectEntries()));

    await act(() => result.current.convert());

    expect(lookerService.convertPbipToLookml).not.toHaveBeenCalled();
  });

  it("marks the result present and still unsaved after a successful conversion (not yet downloaded)", async () => {
    vi.mocked(lookerService.convertPbipToLookml).mockResolvedValue({
      blob: new Blob(["zip-bytes"]),
      result: MOCK_RESULT,
    });

    const { result } = renderHook(() => useLookerConversion());
    act(() => result.current.selectEntries(validProjectEntries()));
    await act(() => result.current.convert());

    await waitFor(() => expect(result.current.result).toEqual(MOCK_RESULT));
    expect(result.current.hasUnsavedWork).toBe(true);
    expect(lookerService.convertPbipToLookml).toHaveBeenCalledWith(expect.any(Blob), "Sales");
  });

  it("clears unsaved work once the package is marked as downloaded", async () => {
    vi.mocked(lookerService.convertPbipToLookml).mockResolvedValue({
      blob: new Blob(["zip-bytes"]),
      result: MOCK_RESULT,
    });

    const { result } = renderHook(() => useLookerConversion());
    act(() => result.current.selectEntries(validProjectEntries()));
    await act(() => result.current.convert());
    await waitFor(() => expect(result.current.result).toEqual(MOCK_RESULT));

    act(() => result.current.markDownloaded());

    expect(result.current.hasUnsavedWork).toBe(false);
  });

  it("surfaces backend errors without crashing", async () => {
    vi.mocked(lookerService.convertPbipToLookml).mockRejectedValue(new Error("No .pbip file was found."));

    const { result } = renderHook(() => useLookerConversion());
    act(() => result.current.selectEntries(validProjectEntries()));
    await act(() => result.current.convert());

    await waitFor(() => expect(result.current.error).toBe("No .pbip file was found."));
    expect(result.current.result).toBeNull();
  });

  it("resets to the initial state", async () => {
    vi.mocked(lookerService.convertPbipToLookml).mockResolvedValue({
      blob: new Blob(["zip-bytes"]),
      result: MOCK_RESULT,
    });

    const { result } = renderHook(() => useLookerConversion());
    act(() => result.current.selectEntries(validProjectEntries()));
    await act(() => result.current.convert());
    await waitFor(() => expect(result.current.result).toEqual(MOCK_RESULT));

    act(() => result.current.reset());

    expect(result.current.project).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.hasUnsavedWork).toBe(false);
  });
});
