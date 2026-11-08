import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReaderModule } from "@/features/parquet/modules/reader/reader-module";
import { parquetService } from "@/services/parquet-service";
import { useParquetHandoffStore } from "@/store/use-parquet-handoff-store";
import type { ParquetFileMetadata, ParquetRowPage, ParquetUploadResult } from "@/types/parquet";

vi.mock("@/services/parquet-service", () => ({
  parquetService: {
    uploadForReading: vi.fn(),
    getReaderRows: vi.fn(),
    getReaderMetadata: vi.fn(),
    getReaderSchema: vi.fn(),
  },
}));

const MOCK_METADATA: ParquetFileMetadata = {
  file_name: "people.parquet",
  file_size_bytes: 2048,
  row_count: 3,
  column_count: 2,
  row_group_count: 1,
  compression: "snappy",
  created_by: "parquet-cpp",
};

const MOCK_UPLOAD_RESULT: ParquetUploadResult = {
  file_id: "abc123",
  metadata: MOCK_METADATA,
  columns: [
    { name: "id", data_type: "int64", nullable: false },
    { name: "name", data_type: "string", nullable: true },
  ],
};

const MOCK_ROW_PAGE: ParquetRowPage = {
  rows: [
    { id: 1, name: "alice" },
    { id: 2, name: "bob" },
    { id: 3, name: "carol" },
  ],
  total_row_count: 3,
  offset: 0,
  limit: 100,
};

function mockFile(name = "people.parquet") {
  return new File(["parquet-bytes"], name, { type: "application/octet-stream" });
}

function getFileInput() {
  return screen.getByTestId("reader-file-input") as HTMLInputElement;
}

async function uploadFile(name = "people.parquet") {
  const input = getFileInput();
  fireEvent.change(input, { target: { files: [mockFile(name)] } });
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
}

beforeEach(() => {
  vi.mocked(parquetService.uploadForReading).mockReset();
  vi.mocked(parquetService.getReaderRows).mockReset();
  useParquetHandoffStore.setState({ pending: null });
});

describe("ReaderModule", () => {
  it("disables the read button until a file is selected", async () => {
    render(<ReaderModule />);
    expect(screen.getByRole("button", { name: /read parquet/i })).toBeDisabled();

    await uploadFile();

    expect(screen.getByRole("button", { name: /read parquet/i })).toBeEnabled();
  });

  it("loads metadata, schema, and rows after a successful upload", async () => {
    vi.mocked(parquetService.uploadForReading).mockResolvedValue(MOCK_UPLOAD_RESULT);
    vi.mocked(parquetService.getReaderRows).mockResolvedValue(MOCK_ROW_PAGE);

    render(<ReaderModule />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /read parquet/i }));

    await screen.findByRole("button", { name: /loaded/i });
    expect(parquetService.uploadForReading).toHaveBeenCalledTimes(1);
    expect(parquetService.getReaderRows).toHaveBeenCalledWith("abc123", 0, 100);

    // Data tab is active by default and shows the loaded rows.
    expect(screen.getByText("alice")).toBeInTheDocument();

    // Schema tab shows the columns.
    fireEvent.click(screen.getByRole("tab", { name: /schema/i }));
    expect(screen.getByText("int64")).toBeInTheDocument();

    // Overview tab shows summary stats.
    fireEvent.click(screen.getByRole("tab", { name: /overview/i }));
    expect(screen.getByText("snappy")).toBeInTheDocument();
  });

  it("shows an error message when upload fails", async () => {
    vi.mocked(parquetService.uploadForReading).mockRejectedValue(new Error("Could not parse file"));

    render(<ReaderModule />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /read parquet/i }));

    expect(await screen.findByText("Could not parse file")).toBeInTheDocument();
  });

  it("rejects non-parquet files without calling the upload service", async () => {
    render(<ReaderModule />);
    const input = getFileInput();
    fireEvent.change(input, {
      target: { files: [new File(["x"], "data.csv", { type: "text/csv" })] },
    });

    expect(await screen.findByText(/is not a \.parquet file/i)).toBeInTheDocument();
    expect(parquetService.uploadForReading).not.toHaveBeenCalled();
  });

  it("auto-preloads a file handed off from Convert Files without a manual upload", async () => {
    vi.mocked(parquetService.uploadForReading).mockResolvedValue(MOCK_UPLOAD_RESULT);
    vi.mocked(parquetService.getReaderRows).mockResolvedValue(MOCK_ROW_PAGE);

    useParquetHandoffStore.getState().setPending({
      blob: new Blob(["parquet-bytes"]),
      fileName: "people.parquet",
      origin: "convert",
    });

    render(<ReaderModule />);

    await screen.findByRole("button", { name: /loaded/i });
    expect(parquetService.uploadForReading).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/automatically loaded from/i)).toBeInTheDocument();
    expect(screen.getByText(/convert files/i)).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();

    // The handoff is one-shot: it must not be replayed on remount/refresh.
    expect(useParquetHandoffStore.getState().pending).toBeNull();
  });

  it("falls back to the normal empty-upload state when there is no pending handoff", () => {
    render(<ReaderModule />);

    expect(parquetService.uploadForReading).not.toHaveBeenCalled();
    expect(screen.queryByText(/automatically loaded from/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no file loaded/i)).toBeInTheDocument();
  });
});
