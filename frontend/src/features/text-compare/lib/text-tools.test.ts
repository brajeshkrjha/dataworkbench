import { describe, expect, it } from "vitest";

import { cleanupText, compareLists, DEFAULT_CLEANUP } from "@/features/text-compare/lib/text-tools";

describe("compareLists", () => {
  it("splits items into only-A, only-B and shared", () => {
    const result = compareLists("a\nb\nc", "b\nc\nd", { ignoreCase: false, trim: true });
    expect(result.onlyInA).toEqual(["a"]);
    expect(result.onlyInB).toEqual(["d"]);
    expect(result.inBoth).toEqual(["b", "c"]);
  });

  it("honours ignoreCase and trim, and collapses duplicates", () => {
    const strict = compareLists("Apple\nPear", "apple ", { ignoreCase: false, trim: false });
    expect(strict.inBoth).toEqual([]);

    const relaxed = compareLists("Apple\nApple\nPear", "apple ", { ignoreCase: true, trim: true });
    expect(relaxed.inBoth).toEqual(["Apple"]);
    expect(relaxed.onlyInA).toEqual(["Pear"]);
    expect(relaxed.totalA).toBe(2);
  });

  it("ignores blank lines", () => {
    expect(compareLists("a\n\n", "\nb", { ignoreCase: false, trim: true }).totalA).toBe(1);
  });
});

describe("cleanupText", () => {
  it("trims and removes empty lines by default", () => {
    const result = cleanupText("  a  \n\n b\n", DEFAULT_CLEANUP);
    expect(result.output).toBe("a\nb");
    expect(result.linesBefore).toBe(4);
    expect(result.linesAfter).toBe(2);
  });

  it("removes duplicates, sorts naturally and changes case", () => {
    const result = cleanupText("b10\nb2\nB2\na", {
      ...DEFAULT_CLEANUP,
      caseMode: "lower",
      removeDuplicates: true,
      sort: "asc",
    });
    expect(result.output).toBe("a\nb2\nb10");
    expect(cleanupText("a\nb", { ...DEFAULT_CLEANUP, sort: "desc" }).output).toBe("b\na");
  });

  it("collapses repeated spaces", () => {
    expect(cleanupText("a   b\t\tc", { ...DEFAULT_CLEANUP, collapseSpaces: true }).output).toBe("a b c");
  });

  it("handles empty input", () => {
    expect(cleanupText("", DEFAULT_CLEANUP)).toEqual({ output: "", linesBefore: 0, linesAfter: 0 });
  });
});
