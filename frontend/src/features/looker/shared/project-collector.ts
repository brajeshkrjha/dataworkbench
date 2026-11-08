/**
 * Resolves a selected PBIP project (a folder the user drops or browses to,
 * or a lone .pbip file) into the same on-disk shape the conversion engine
 * expects: a .pbip file plus its sibling `<Name>.Report` and
 * `<Name>.SemanticModel` folders. The user only ever sees "PBIP project" —
 * the ZIP packaging step (see zip-writer.ts) that follows is an internal
 * transport detail, not something surfaced in the UI.
 */
import type { PbipValidation } from "@/types/looker";

export interface CollectedEntry {
  /** Forward-slash separated path, relative to whatever root the user picked. */
  relativePath: string;
  file: File;
}

/** Read every File out of a `webkitdirectory` file input's FileList. */
export function collectDirectoryInputEntries(fileList: FileList): CollectedEntry[] {
  return Array.from(fileList).map((file) => ({
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    file,
  }));
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}

async function walkEntry(entry: FileSystemEntry, prefix: string, out: CollectedEntry[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    out.push({ relativePath: `${prefix}${entry.name}`, file });
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children = await readAllEntries(reader);
    for (const child of children) {
      await walkEntry(child, `${prefix}${entry.name}/`, out);
    }
  }
}

/** Read every file out of a drag-and-drop DataTransfer, preserving folder structure. */
export async function collectDroppedEntries(dataTransfer: DataTransfer): Promise<CollectedEntry[]> {
  const items = Array.from(dataTransfer.items);
  const supportsEntries = items.length > 0 && typeof items[0].webkitGetAsEntry === "function";

  if (supportsEntries) {
    const out: CollectedEntry[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) await walkEntry(entry, "", out);
    }
    return out;
  }

  return Array.from(dataTransfer.files).map((file) => ({ relativePath: file.name, file }));
}

export interface ScopedProject {
  projectName: string;
  /** Entries limited to the resolved project, with paths relative to its own folder. */
  entries: CollectedEntry[];
  validation: PbipValidation;
}

const NO_PBIP_VALIDATION: PbipValidation = {
  status: "invalid",
  hasPbip: false,
  hasReportFolder: false,
  hasSemanticModelFolder: false,
  projectName: null,
};

/** Archive/OS noise that must never be mistaken for project content. */
const JUNK_PATH = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|\._)/i;

/**
 * Power BI Desktop's local model cache (`<Name>.SemanticModel/.pbi/cache.abf`
 * and friends). It can be multiple gigabytes, the conversion pipeline never
 * reads it (only `.json`/`.tmdl`/`.m`/`.bim`/`.pbism`/`.dax` under the model
 * root are parsed), and pulling its bytes into memory to build a client-side
 * ZIP is what causes the browser to report the file as unreadable. Excluded
 * from folder-picked selections before anything ever touches its contents.
 */
const PBI_CACHE_PATH = /(^|\/)\.pbi\//i;

/** ZIP entries and `webkitRelativePath` disagree on separators and leading "./". */
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

interface PbipProjectMatch {
  projectName: string;
  /** Normalized path of the .pbip within the selection. */
  pbipPath: string;
  /** Folder holding the .pbip, with a trailing slash (empty when at the root). */
  projectDir: string;
  hasReportFolder: boolean;
  hasSemanticModelFolder: boolean;
}

/**
 * Locates a PBIP project inside an arbitrary list of paths — the files of a
 * picked folder, or the entry names of an uploaded ZIP. This mirrors the
 * backend's `resolve_pbip_roots`: find the .pbip, then look for the
 * `<Name>.Report` and `<Name>.SemanticModel` folders beside it.
 *
 * Nothing depends on the name of the enclosing folder or archive, and the
 * project may sit at any depth. Candidates are tried shallowest-first and the
 * first one that fully resolves wins, so a nested backup copy never shadows
 * the real project.
 */
function findPbipProject(paths: string[]): PbipProjectMatch | null {
  const normalized = paths.map(normalizePath).filter((path) => path && !JUNK_PATH.test(path));
  const lowered = normalized.map((path) => path.toLowerCase());

  const candidates = normalized
    .filter((path) => path.toLowerCase().endsWith(".pbip"))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));

  let fallback: PbipProjectMatch | null = null;

  for (const pbipPath of candidates) {
    const lastSlash = pbipPath.lastIndexOf("/");
    const projectDir = lastSlash === -1 ? "" : pbipPath.slice(0, lastSlash + 1);
    const projectName = pbipPath.slice(projectDir.length, pbipPath.length - ".pbip".length);
    const reportPrefix = `${projectDir}${projectName}.report/`.toLowerCase();
    const modelPrefix = `${projectDir}${projectName}.semanticmodel/`.toLowerCase();

    const match: PbipProjectMatch = {
      projectName,
      pbipPath,
      projectDir,
      hasReportFolder: lowered.some((path) => path.startsWith(reportPrefix)),
      hasSemanticModelFolder: lowered.some((path) => path.startsWith(modelPrefix)),
    };

    if (match.hasReportFolder && match.hasSemanticModelFolder) return match;
    fallback ??= match;
  }

  return fallback;
}

function validationFor(match: PbipProjectMatch | null): PbipValidation {
  if (!match) return NO_PBIP_VALIDATION;
  return {
    status: match.hasReportFolder && match.hasSemanticModelFolder ? "valid" : "invalid",
    hasPbip: true,
    hasReportFolder: match.hasReportFolder,
    hasSemanticModelFolder: match.hasSemanticModelFolder,
    projectName: match.projectName,
  };
}

/**
 * Finds the .pbip file among the collected entries, then scopes the result
 * down to just that project: the .pbip itself plus its `<Name>.Report` and
 * `<Name>.SemanticModel` sibling folders, so anything else the user's folder
 * happens to contain is safely ignored. Paths in the result are re-rooted at
 * the project folder, making the outcome independent of what the enclosing
 * folder was called.
 */
export function scopeProject(entries: CollectedEntry[]): ScopedProject {
  const normalized = entries.map((entry) => ({
    relativePath: normalizePath(entry.relativePath),
    file: entry.file,
  }));
  const match = findPbipProject(normalized.map((entry) => entry.relativePath));

  if (!match) {
    return { projectName: "", entries: [], validation: NO_PBIP_VALIDATION };
  }

  const { projectDir, projectName, pbipPath } = match;
  const reportPrefix = `${projectDir}${projectName}.report/`.toLowerCase();
  const modelPrefix = `${projectDir}${projectName}.semanticmodel/`.toLowerCase();

  const scoped: CollectedEntry[] = [];
  for (const entry of normalized) {
    const lower = entry.relativePath.toLowerCase();
    const belongs =
      entry.relativePath === pbipPath ||
      lower.startsWith(reportPrefix) ||
      lower.startsWith(modelPrefix);
    if (belongs && !PBI_CACHE_PATH.test(entry.relativePath)) {
      scoped.push({ relativePath: entry.relativePath.slice(projectDir.length), file: entry.file });
    }
  }

  return { projectName, entries: scoped, validation: validationFor(match) };
}

/**
 * For Bulk Conversion: unlike `scopeProject`, this does NOT look for a single
 * `.pbip` — it keeps the whole parent folder's structure intact (minus junk
 * and the Power BI cache) so the backend's bulk discovery can find every
 * project subfolder itself. Mirrors the same exclusion rules `scopeProject`
 * applies per-project, just without narrowing to one project first.
 */
export function scopeBulkEntries(entries: CollectedEntry[]): CollectedEntry[] {
  return entries
    .map((entry) => ({ relativePath: normalizePath(entry.relativePath), file: entry.file }))
    .filter((entry) => entry.relativePath && !JUNK_PATH.test(entry.relativePath) && !PBI_CACHE_PATH.test(entry.relativePath));
}
