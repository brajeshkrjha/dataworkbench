import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildProjectZip } from "@/features/looker/shared/project-zip";
import { buildCompressedZip } from "@/features/looker/shared/zip-writer";

vi.mock("@/features/looker/shared/zip-writer", () => ({ buildCompressedZip: vi.fn(() => new Blob(["zip"])) }));

beforeEach(() => vi.mocked(buildCompressedZip).mockClear());

describe("buildProjectZip", () => {
  it("preserves entry order, relative paths, and bytes with the FileReader fallback", async () => {
    const entries = [
      { relativePath: "Project.pbip", file: new File(["{}"], "Project.pbip") },
      { relativePath: "Project.SemanticModel/model.tmdl", file: new File(["model"], "model.tmdl") },
    ];
    await buildProjectZip(entries);
    expect(buildCompressedZip).toHaveBeenCalledTimes(1);
    // Compare bytes rather than typed-array prototypes across jsdom/Node realms.
    const packaged = vi.mocked(buildCompressedZip).mock.calls[0][0];
    expect(packaged.map(({ name, data }) => ({ name, data: Array.from(data) }))).toEqual([
      { name: entries[0].relativePath, data: [123, 125] },
      { name: entries[1].relativePath, data: [109, 111, 100, 101, 108] },
    ]);
  });

  it("uses native arrayBuffer when available", async () => {
    const file = new File([], "data");
    const bytes = new Uint8Array([1, 2, 3]);
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(bytes.buffer) });
    await buildProjectZip([{ file, relativePath: "folder/data" }]);
    expect(file.arrayBuffer).toHaveBeenCalledTimes(1);
    expect(buildCompressedZip).toHaveBeenCalledWith([{ name: "folder/data", data: bytes }]);
  });

  it("propagates read failures without packaging a partial archive", async () => {
    const file = new File([], "unreadable");
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockRejectedValue(new Error("Read failed")) });
    await expect(buildProjectZip([{ file, relativePath: file.name }])).rejects.toThrow("Read failed");
    expect(buildCompressedZip).not.toHaveBeenCalled();
  });
});