/**
 * Reads a PBIP project (or a parent folder of projects) out of a user-supplied
 * `.zip` file entirely in the browser, producing the same `CollectedEntry[]` a
 * dropped/picked folder would. Everything downstream (project scoping,
 * validation, compressed re-packaging) is therefore identical for ZIP and
 * folder uploads.
 *
 * Power BI's local cache (`.pbi/cache.abf`, often hundreds of MB) and archive
 * junk are skipped *before* decompression, so they are never read into memory
 * and the re-packed upload stays small enough for serverless request limits.
 */
import { isExcludedPath, type CollectedEntry } from "@/features/looker/shared/project-collector";

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT = 0xffff;

export class ZipReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipReadError";
  }
}

interface CentralEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
  encrypted: boolean;
}

async function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsArrayBuffer(blob);
  });
}

async function readCentralDirectory(file: File): Promise<CentralEntry[]> {
  const tailSize = Math.min(file.size, EOCD_MIN_SIZE + MAX_COMMENT);
  if (tailSize < EOCD_MIN_SIZE) throw new ZipReadError("This file is not a valid ZIP archive.");

  const tail = await readBytes(file.slice(file.size - tailSize));
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);

  let eocd = -1;
  for (let i = tail.length - EOCD_MIN_SIZE; i >= 0; i--) {
    if (tailView.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new ZipReadError("This file is not a valid ZIP archive.");

  const total = tailView.getUint16(eocd + 10, true);
  const cdSize = tailView.getUint32(eocd + 12, true);
  const cdOffset = tailView.getUint32(eocd + 16, true);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new ZipReadError("ZIP64 archives are not supported. Re-zip the project with standard compression.");
  }
  if (cdOffset + cdSize > file.size) throw new ZipReadError("The ZIP archive is corrupt or incomplete.");

  const cd = await readBytes(file.slice(cdOffset, cdOffset + cdSize));
  const view = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const decoder = new TextDecoder("utf-8");
  const entries: CentralEntry[] = [];

  let pos = 0;
  while (pos + 46 <= cd.length && view.getUint32(pos, true) === CENTRAL_SIG) {
    const flags = view.getUint16(pos + 8, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const localOffset = view.getUint32(pos + 42, true);
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new ZipReadError("ZIP64 archives are not supported. Re-zip the project with standard compression.");
    }
    entries.push({
      name: decoder.decode(cd.subarray(pos + 46, pos + 46 + nameLength)),
      method: view.getUint16(pos + 10, true),
      compressedSize,
      localOffset,
      encrypted: (flags & 0x1) !== 0,
    });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(compressed: Blob): Promise<Blob> {
  if (typeof DecompressionStream === "undefined") {
    throw new ZipReadError("This browser can't open compressed ZIP files. Please use a current version of Chrome, Edge or Firefox.");
  }
  const stream = compressed.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).blob();
}

async function extractEntry(file: File, entry: CentralEntry): Promise<File> {
  const header = await readBytes(file.slice(entry.localOffset, entry.localOffset + 30));
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (header.length < 30 || view.getUint32(0, true) !== LOCAL_SIG) {
    throw new ZipReadError(`The ZIP archive is corrupt (bad entry "${entry.name}").`);
  }
  const dataStart = entry.localOffset + 30 + view.getUint16(26, true) + view.getUint16(28, true);
  const raw = file.slice(dataStart, dataStart + entry.compressedSize);

  let content: Blob;
  if (entry.method === 0) content = raw;
  else if (entry.method === 8) content = await inflate(raw);
  else throw new ZipReadError(`Unsupported ZIP compression method in "${entry.name}".`);

  const baseName = entry.name.split("/").pop() || entry.name;
  return new File([content], baseName);
}

/** Open a `.zip` and return its (non-excluded) files as folder-style entries. */
export async function readZipEntries(zipFile: File): Promise<CollectedEntry[]> {
  const central = await readCentralDirectory(zipFile);
  const wanted = central
    .map((entry) => ({ ...entry, name: entry.name.replace(/\\/g, "/") }))
    .filter((entry) => !entry.name.endsWith("/") && !isExcludedPath(entry.name));

  if (wanted.some((entry) => entry.encrypted)) {
    throw new ZipReadError("Password-protected ZIP files are not supported.");
  }

  const entries: CollectedEntry[] = [];
  for (const entry of wanted) {
    entries.push({ relativePath: entry.name, file: await extractEntry(zipFile, entry) });
  }
  if (entries.length === 0) throw new ZipReadError("The ZIP archive contains no usable files.");
  return entries;
}

const ZIP_NAME = /\.zip$/i;

/**
 * If the selection is a single `.zip`, expand it into project entries;
 * any other selection (a folder's files) passes through untouched.
 */
export async function expandZipSelection(entries: CollectedEntry[]): Promise<CollectedEntry[]> {
  if (entries.length === 1 && ZIP_NAME.test(entries[0].relativePath)) {
    return readZipEntries(entries[0].file);
  }
  return entries;
}
