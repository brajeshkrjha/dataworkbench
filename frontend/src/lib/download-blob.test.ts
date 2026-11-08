import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadBlob } from "@/lib/download-blob";

beforeEach(() => {
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:download");
    static revokeObjectURL = vi.fn();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadBlob", () => {
  it("preserves the filename, clicks once, and releases the URL", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe("blob:download");
      expect(this.download).toBe("report.md");
    });
    const blob = new Blob(["report"]);

    downloadBlob(blob, "report.md");

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:download");
  });

  it("releases the URL when starting the download throws", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("Download blocked");
    });

    expect(() => downloadBlob(new Blob(), "report.md")).toThrow("Download blocked");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:download");
  });
});