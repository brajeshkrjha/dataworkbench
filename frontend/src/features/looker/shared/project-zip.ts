import type { CollectedEntry } from "@/features/looker/shared/project-collector";
import { buildCompressedZip } from "@/features/looker/shared/zip-writer";

function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  // FileReader also supports environments without Blob.arrayBuffer (including jsdom).
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsArrayBuffer(file);
  });
}

/** Package already-scoped entries; callers retain their existing project/cache exclusions. */
export async function buildProjectZip(entries: CollectedEntry[]): Promise<Blob> {
  const zipEntries = await Promise.all(
    entries.map(async (entry) => ({
      name: entry.relativePath,
      data: await readFileBytes(entry.file),
    }))
  );
  return buildCompressedZip(zipEntries);
}