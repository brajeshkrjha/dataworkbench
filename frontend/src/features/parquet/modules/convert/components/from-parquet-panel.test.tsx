import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FromParquetPanel } from "@/features/parquet/modules/convert/components/from-parquet-panel";
import { parquetService } from "@/services/parquet-service";
import { useParquetCsvExportStore } from "@/store/use-parquet-csv-export-store";
import { useParquetHandoffStore } from "@/store/use-parquet-handoff-store";
import type { ParquetFileMetadata, ParquetToCsvResult, ParquetUploadResult } from "@/types/parquet";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/services/parquet-service", () => ({
  parquetService: {
    uploadForCsvExport: vi.fn(),
    exportParquetToCsv: vi.fn(),
  },
}));

const MOCK_METADATA: ParquetFileMetadata = {
  file_name: "people.parquet",
  file_size_bytes: 500,
  row_count: 3,
  column_count: 2,
  row_group_count: 1,
  compression: "snappy",
  created_by: "pyarrow",
};

const MOCK_UPLOAD: ParquetUploadResult = {
  file_id: "file-123",
  metadata: MOCK_METADATA,
  columns: [
    { name: "id", data_type: "int64", nullable: false },
    { name: "name", data_type: "string", nullable: true },
  ],
};

const MOCK_RESULT: ParquetToCsvResult = {
  fileName: "people_20260929_120000.csv",
  rowCount: 3,
  columnCount: 2,
  sourceBytes: 500,
  outputBytes: 100,
};

function mockFile(name = "people.parquet") {
  return new File(["parquet-bytes"], name, { type: "application/octet-stream" });
}

function getFileInput() {
  return screen.getByTestId("parquet-file-input") as HTMLInputElement;
}

async function uploadFile(name = "people.parquet") {
  fireEvent.change(getFileInput(), { target: { files: [mockFile(name)] } });
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
}

beforeEach(() => {
  vi.mocked(parquetService.uploadForCsvExport).mockReset();
  vi.mocked(parquetService.exportParquetToCsv).mockReset();
  pushMock.mockReset();
  useParquetCsvExportStore.getState().reset();
  useParquetHandoffStore.setState({ pending: null });
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("FromParquetPanel (Parquet -> CSV)", () => {
  it("validates an uploaded parquet file and shows a preview", async () => {
    vi.mocked(parquetService.uploadForCsvExport).mockResolvedValue(MOCK_UPLOAD);

    render(<FromParquetPanel />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /validate & preview/i }));

    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
  });

  it("surfaces an error for an invalid parquet file", async () => {
    vi.mocked(parquetService.uploadForCsvExport).mockRejectedValue(new Error("Could not parse file"));

    render(<FromParquetPanel />);
    await uploadFile("broken.parquet");
    fireEvent.click(screen.getByRole("button", { name: /validate & preview/i }));

    await waitFor(() => expect(screen.getByText("Could not parse file")).toBeInTheDocument());
  });

  it("exports to CSV and shows download + open-in-reader actions", async () => {
    vi.mocked(parquetService.uploadForCsvExport).mockResolvedValue(MOCK_UPLOAD);
    vi.mocked(parquetService.exportParquetToCsv).mockResolvedValue({
      blob: new Blob(["csv-bytes"]),
      result: MOCK_RESULT,
    });

    render(<FromParquetPanel />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /validate & preview/i }));
    await screen.findByText("id");

    fireEvent.click(screen.getByRole("button", { name: /convert to csv/i }));

    const completedButton = await screen.findByRole("button", { name: /converted/i });
    expect(completedButton).toBeDisabled();
    expect(screen.getByRole("link", { name: /download csv/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open in parquet reader/i }));
    expect(pushMock).toHaveBeenCalledWith("/tools/parquet-utility/reader");
    expect(useParquetHandoffStore.getState().pending?.fileName).toBe("people.parquet");
  });

  it("applies the selected delimiter, header, and quoting options on export", async () => {
    vi.mocked(parquetService.uploadForCsvExport).mockResolvedValue(MOCK_UPLOAD);
    vi.mocked(parquetService.exportParquetToCsv).mockResolvedValue({
      blob: new Blob(["csv-bytes"]),
      result: MOCK_RESULT,
    });

    render(<FromParquetPanel />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /validate & preview/i }));
    await screen.findByText("id");

    fireEvent.click(screen.getByRole("button", { name: /^pipe/i }));
    fireEvent.click(screen.getByRole("button", { name: /exclude header/i }));
    fireEvent.click(screen.getByRole("button", { name: /^minimal/i }));
    fireEvent.click(screen.getByRole("button", { name: /convert to csv/i }));

    await waitFor(() =>
      expect(parquetService.exportParquetToCsv).toHaveBeenCalledWith("file-123", {
        delimiter: "pipe",
        includeHeader: false,
        quoting: "minimal",
        outputFileName: "",
      })
    );
  });
});
