// @vitest-environment node
import { describe, expect, it } from "vitest";

import { scopeProject, scopeBulkEntries } from "@/features/looker/shared/project-collector";
import { buildCompressedZip, buildStoredZip } from "@/features/looker/shared/zip-writer";
import { expandZipSelection, readZipEntries, ZipReadError } from "@/features/looker/shared/zip-reader";

const enc = (text: string) => new TextEncoder().encode(text);

const PROJECT = [
  { name: "Sales/Sales.pbip", data: enc("{}") },
  { name: "Sales/Sales.Report/report.json", data: enc("r".repeat(2000)) },
  { name: "Sales/Sales.Report/.pbi/localSettings.json", data: enc("{}") },
  { name: "Sales/Sales.SemanticModel/definition.pbism", data: enc("m".repeat(2000)) },
  { name: "Sales/Sales.SemanticModel/.pbi/cache.abf", data: enc("x".repeat(5000)) },
  { name: "__MACOSX/Sales/._Sales.pbip", data: enc("junk") },
];

async function zipFile(entries: typeof PROJECT, compressed: boolean): Promise<File> {
  const blob = compressed ? await buildCompressedZip(entries) : buildStoredZip(entries);
  return new File([blob], "project.zip");
}

describe("readZipEntries", () => {
  it.each([true, false])("reads project files and skips cache/junk (compressed=%s)", async (compressed) => {
    const entries = await readZipEntries(await zipFile(PROJECT, compressed));
    expect(entries.map((e) => e.relativePath).sort()).toEqual([
      "Sales/Sales.Report/report.json",
      "Sales/Sales.SemanticModel/definition.pbism",
      "Sales/Sales.pbip",
    ]);
    const report = entries.find((e) => e.relativePath.endsWith("report.json"))!;
    expect(await report.file.text()).toBe("r".repeat(2000));
    expect(report.file.name).toBe("report.json");
  });

  it("produces entries that scope into a valid project and a bulk selection", async () => {
    const entries = await readZipEntries(await zipFile(PROJECT, true));
    const scoped = scopeProject(entries);
    expect(scoped.validation.status).toBe("valid");
    expect(scoped.projectName).toBe("Sales");
    expect(scopeBulkEntries(entries)).toHaveLength(3);
  });

  it("rejects non-zip data", async () => {
    await expect(readZipEntries(new File([enc("not a zip at all, definitely")], "x.zip"))).rejects.toBeInstanceOf(ZipReadError);
  });

  it("rejects an archive with only excluded files", async () => {
    const file = await zipFile([PROJECT[4]], false);
    await expect(readZipEntries(file)).rejects.toThrow("no usable files");
  });

  it("rejects password-protected entries", async () => {
    const bytes = new Uint8Array(await buildStoredZip([PROJECT[0]]).arrayBuffer());
    const view = new DataView(bytes.buffer);
    // Central directory header starts after the local entry; set the encryption flag bit.
    for (let i = 0; i < bytes.length - 4; i++) {
      if (view.getUint32(i, true) === 0x02014b50) view.setUint16(i + 8, 1, true);
    }
    await expect(readZipEntries(new File([bytes], "x.zip"))).rejects.toThrow("Password-protected");
  });
});

describe("expandZipSelection", () => {
  it("expands a lone zip and leaves folder selections untouched", async () => {
    const zip = await zipFile(PROJECT, true);
    const expanded = await expandZipSelection([{ relativePath: "Sales.zip", file: zip }]);
    expect(expanded).toHaveLength(3);

    const folder = [
      { relativePath: "Sales/Sales.pbip", file: new File(["{}"], "Sales.pbip") },
      { relativePath: "Sales/other.zip", file: new File(["x"], "other.zip") },
    ];
    expect(await expandZipSelection(folder)).toBe(folder);
  });
});
