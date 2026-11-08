import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyzerModule } from "@/features/parquet/modules/analyzer/analyzer-module";
import { parquetService } from "@/services/parquet-service";
import type {
  ColumnProfile,
  ParquetFileMetadata,
  ParquetSample,
  ParquetStatistics,
  ParquetUploadResult,
  StorageAnalysis,
} from "@/types/parquet";

vi.mock("@/services/parquet-service", () => ({
  parquetService: {
    uploadForAnalysis: vi.fn(),
    getAnalyzerOverview: vi.fn(),
    getAnalyzerSchema: vi.fn(),
    getAnalyzerStatistics: vi.fn(),
    getAnalyzerColumnProfile: vi.fn(),
    getAnalyzerSample: vi.fn(),
    getAnalyzerStorage: vi.fn(),
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

const MOCK_STATISTICS: ParquetStatistics = {
  row_count: 3,
  column_count: 2,
  columns: [
    {
      name: "id",
      data_type: "int64",
      null_count: 0,
      null_percentage: 0,
      distinct_count: 3,
      min_value: "1",
      max_value: "3",
      avg_value: 2,
    },
    {
      name: "name",
      data_type: "string",
      null_count: 0,
      null_percentage: 0,
      distinct_count: 3,
      min_value: "alice",
      max_value: "carol",
      avg_value: null,
    },
  ],
};

const MOCK_PROFILE: ColumnProfile = {
  name: "name",
  data_type: "string",
  null_count: 0,
  null_percentage: 0,
  distinct_count: 3,
  cardinality_ratio: 1,
  most_common_values: [{ value: "alice", count: 1 }],
  min_value: "alice",
  max_value: "carol",
  avg_value: null,
};

const MOCK_SAMPLE: ParquetSample = {
  mode: "first",
  sample_size: 3,
  rows: [
    { id: 1, name: "alice" },
    { id: 2, name: "bob" },
  ],
};

const MOCK_STORAGE: StorageAnalysis = {
  compression: "snappy",
  total_compressed_bytes: 1024,
  total_uncompressed_bytes: 2048,
  overall_compression_ratio: 2,
  row_groups: [{ index: 0, row_count: 3, compressed_size_bytes: 1024, uncompressed_size_bytes: 2048 }],
  columns: [
    { name: "id", compressed_size_bytes: 512, uncompressed_size_bytes: 1024, compression_ratio: 2 },
    { name: "name", compressed_size_bytes: 512, uncompressed_size_bytes: 1024, compression_ratio: 2 },
  ],
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
  vi.mocked(parquetService.uploadForAnalysis).mockReset();
  vi.mocked(parquetService.getAnalyzerStatistics).mockReset();
  vi.mocked(parquetService.getAnalyzerColumnProfile).mockReset();
  vi.mocked(parquetService.getAnalyzerSample).mockReset();
  vi.mocked(parquetService.getAnalyzerStorage).mockReset();
});

async function analyzeFile() {
  vi.mocked(parquetService.uploadForAnalysis).mockResolvedValue(MOCK_UPLOAD_RESULT);
  render(<AnalyzerModule />);
  await uploadFile();
  fireEvent.click(screen.getByRole("button", { name: /analyze/i }));
  await screen.findByRole("button", { name: /loaded/i });
}

describe("AnalyzerModule", () => {
  it("disables the analyze button until a file is selected", async () => {
    render(<AnalyzerModule />);
    expect(screen.getByRole("button", { name: /analyze/i })).toBeDisabled();

    await uploadFile();

    expect(screen.getByRole("button", { name: /analyze/i })).toBeEnabled();
  });

  it("shows an error message when upload fails", async () => {
    vi.mocked(parquetService.uploadForAnalysis).mockRejectedValue(new Error("Could not parse file"));

    render(<AnalyzerModule />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /analyze/i }));

    expect(await screen.findByText("Could not parse file")).toBeInTheDocument();
  });

  it("shows the Overview tab by default with file metadata", async () => {
    await analyzeFile();
    expect(screen.getByText("snappy")).toBeInTheDocument();
  });

  it("shows the Schema tab with columns", async () => {
    await analyzeFile();
    fireEvent.click(screen.getByRole("tab", { name: /^schema$/i }));
    expect(screen.getByText("int64")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
  });

  it("loads and shows the Statistics tab lazily", async () => {
    vi.mocked(parquetService.getAnalyzerStatistics).mockResolvedValue(MOCK_STATISTICS);
    await analyzeFile();

    expect(parquetService.getAnalyzerStatistics).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: /statistics/i }));

    await waitFor(() => expect(parquetService.getAnalyzerStatistics).toHaveBeenCalledWith("abc123"));
    expect(await screen.findByText("alice")).toBeInTheDocument();
  });

  it("loads a column profile when a column is selected on the Profiling tab", async () => {
    vi.mocked(parquetService.getAnalyzerColumnProfile).mockResolvedValue(MOCK_PROFILE);
    await analyzeFile();

    fireEvent.click(screen.getByRole("tab", { name: /column profiling/i }));
    fireEvent.click(screen.getByRole("button", { name: "name" }));

    await waitFor(() =>
      expect(parquetService.getAnalyzerColumnProfile).toHaveBeenCalledWith("abc123", "name")
    );
    expect(await screen.findByText(/Most common values/i)).toBeInTheDocument();
  });

  it("loads a sample on the Sampling tab", async () => {
    vi.mocked(parquetService.getAnalyzerSample).mockResolvedValue(MOCK_SAMPLE);
    await analyzeFile();

    fireEvent.click(screen.getByRole("tab", { name: /sampling/i }));
    fireEvent.click(screen.getByRole("button", { name: /get sample/i }));

    await waitFor(() => expect(parquetService.getAnalyzerSample).toHaveBeenCalled());
    expect(await screen.findByText("bob")).toBeInTheDocument();
  });

  it("loads and shows the Storage Analysis tab lazily", async () => {
    vi.mocked(parquetService.getAnalyzerStorage).mockResolvedValue(MOCK_STORAGE);
    await analyzeFile();

    expect(parquetService.getAnalyzerStorage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: /storage analysis/i }));

    await waitFor(() => expect(parquetService.getAnalyzerStorage).toHaveBeenCalledWith("abc123"));
    expect((await screen.findAllByText("2.00x")).length).toBeGreaterThan(0);
  });

  it.each([
    { tab: "Statistics", request: parquetService.getAnalyzerStatistics },
    { tab: "Storage Analysis", request: parquetService.getAnalyzerStorage },
  ])("does not retry a failed $tab request on every render", async ({ tab, request }) => {
    vi.mocked(request).mockRejectedValue(new Error("Session unavailable"));
    await analyzeFile();
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Session unavailable");
    fireEvent.change(screen.getByRole("textbox", { name: /search columns/i }), { target: { value: "id" } });
    expect(request).toHaveBeenCalledTimes(1);

    // Reopening a tab remains an explicit retry, rather than an automatic loop.
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it("rejects non-parquet files without calling the upload service", async () => {
    render(<AnalyzerModule />);
    const input = getFileInput();
    fireEvent.change(input, {
      target: { files: [new File(["x"], "data.csv", { type: "text/csv" })] },
    });

    expect(await screen.findByText(/is not a \.parquet file/i)).toBeInTheDocument();
    expect(parquetService.uploadForAnalysis).not.toHaveBeenCalled();
  });
});
