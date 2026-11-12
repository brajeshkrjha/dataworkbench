/**
 * Minimal "store" (uncompressed) ZIP writer used to package a selected
 * PBIP project folder into the archive the backend conversion pipeline
 * expects. No compression library is needed since PBIP projects are
 * small, text-based JSON/TMDL trees — this is purely a transport detail
 * hidden from the user, who only ever interacts with a .pbip file.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

export interface ZipEntryInput {
  /** Forward-slash separated path, relative to the archive root. */
  name: string;
  data: Uint8Array;
  /** Pre-compressed raw-deflate bytes; when set the entry is written with method 8. */
  deflated?: Uint8Array;
}

/** Build an uncompressed (store-method) ZIP archive from a set of entries. */
export function buildStoredZip(entries: ZipEntryInput[]): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const stored = entry.deflated ?? entry.data;
    const method = entry.deflated ? 8 : 0;
    const csize = stored.length;
    const size = entry.data.length;

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(6, 0, true);
    localHeader.setUint16(8, method, true);
    localHeader.setUint16(10, time, true);
    localHeader.setUint16(12, date, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, csize, true);
    localHeader.setUint32(22, size, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true);
    localParts.push(localHeader.buffer, nameBytes, stored as BlobPart);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true);
    centralHeader.setUint16(6, 20, true);
    centralHeader.setUint16(8, 0, true);
    centralHeader.setUint16(10, method, true);
    centralHeader.setUint16(12, time, true);
    centralHeader.setUint16(14, date, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, csize, true);
    centralHeader.setUint32(24, size, true);
    centralHeader.setUint16(28, nameBytes.length, true);
    centralHeader.setUint16(30, 0, true);
    centralHeader.setUint16(32, 0, true);
    centralHeader.setUint16(34, 0, true);
    centralHeader.setUint16(36, 0, true);
    centralHeader.setUint32(38, 0, true);
    centralHeader.setUint32(42, offset, true);
    centralParts.push(centralHeader.buffer, nameBytes);
    centralSize += 46 + nameBytes.length;

    offset += 30 + nameBytes.length + csize;
  }

  const centralStart = offset;
  const endRecord = new DataView(new ArrayBuffer(22));
  endRecord.setUint32(0, 0x06054b50, true);
  endRecord.setUint16(4, 0, true);
  endRecord.setUint16(6, 0, true);
  endRecord.setUint16(8, entries.length, true);
  endRecord.setUint16(10, entries.length, true);
  endRecord.setUint32(12, centralSize, true);
  endRecord.setUint32(16, centralStart, true);
  endRecord.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endRecord.buffer], {
    type: "application/zip",
  });
}

/** Raw-deflate compress bytes with the browser's native CompressionStream; null if unsupported. */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Build a deflate-compressed ZIP. PBIP projects are text-heavy and compress
 * ~10x, keeping uploads under serverless request-body limits (Vercel: ~4.5 MB).
 * Falls back to stored entries where compression is unavailable or not smaller.
 */
export async function buildCompressedZip(entries: ZipEntryInput[]): Promise<Blob> {
  const compressed = await Promise.all(
    entries.map(async (entry) => {
      const deflated = await deflateRaw(entry.data);
      return deflated && deflated.length < entry.data.length ? { ...entry, deflated } : entry;
    })
  );
  return buildStoredZip(compressed);
}
