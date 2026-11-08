import { describe, expect, it } from "vitest";

import { formatBytes as lookerFormatBytes } from "@/features/looker/shared/format-bytes";
import { formatBytes as parquetFormatBytes } from "@/features/parquet/shared/format-bytes";
import { formatBytes } from "@/lib/format-bytes";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"], [1023, "1023 B"], [1024, "1.0 KB"], [1536, "1.5 KB"],
    [1024 ** 2, "1.0 MB"], [1024 ** 3, "1.0 GB"], [1024 ** 4, "1.0 TB"],
    [1024 ** 5, "1024.0 TB"],
  ])("preserves formatting for %i bytes", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("uses one implementation across both feature modules", () => {
    expect(lookerFormatBytes).toBe(formatBytes);
    expect(parquetFormatBytes).toBe(formatBytes);
  });
});