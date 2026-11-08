import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConvertModule } from "@/features/parquet/modules/convert/convert-module";
import { parquetService } from "@/services/parquet-service";
import { useParquetConversionStore } from "@/store/use-parquet-conversion-store";
import { useParquetHandoffStore } from "@/store/use-parquet-handoff-store";
import type { ConversionResult } from "@/types/parquet";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/services/parquet-service", () => ({
  parquetService: {
    convertToParquet: vi.fn(),
  },
}));

const MOCK_RESULT: ConversionResult = {
  fileName: "people_20260929_120000.parquet",
  sourceFormat: "csv",
  compression: "snappy",
  rowCount: 2,
  columnCount: 2,
  sourceBytes: 20,
  outputBytes: 200,
  schemaSummary: { string: 1, integer: 1 },
};

function mockFile(name = "people.csv") {
  return new File(["id,name\n1,alice"], name, { type: "text/csv" });
}

function getFileInput() {
  return screen.getByTestId("parquet-file-input") as HTMLInputElement;
}

async function uploadFile(name = "people.csv") {
  const input = getFileInput();
  fireEvent.change(input, { target: { files: [mockFile(name)] } });
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
}

beforeEach(() => {
  vi.mocked(parquetService.convertToParquet).mockReset();
  pushMock.mockReset();
  useParquetConversionStore.getState().reset();
  useParquetHandoffStore.setState({ pending: null });
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("ConvertModule", () => {
  it("disables the convert button until a file is selected", async () => {
    render(<ConvertModule />);
    expect(screen.getByRole("button", { name: /convert to parquet/i })).toBeDisabled();

    await uploadFile();

    expect(screen.getByRole("button", { name: /convert to parquet/i })).toBeEnabled();
  });

  it("disables and relabels the convert button after a successful conversion", async () => {
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: MOCK_RESULT,
    });

    render(<ConvertModule />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /convert to parquet/i }));

    const completedButton = await screen.findByRole("button", { name: /converted/i });
    expect(completedButton).toBeDisabled();
    expect(parquetService.convertToParquet).toHaveBeenCalledTimes(1);
  });

  it("re-enables conversion once a new file is selected after completion", async () => {
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: MOCK_RESULT,
    });

    render(<ConvertModule />);
    await uploadFile("first.csv");
    fireEvent.click(screen.getByRole("button", { name: /convert to parquet/i }));
    await screen.findByRole("button", { name: /converted/i });

    // Remove the completed file, then select a new one.
    fireEvent.click(screen.getByRole("button", { name: /remove file/i }));
    await uploadFile("second.csv");

    expect(screen.getByRole("button", { name: /convert to parquet/i })).toBeEnabled();
  });

  it("does not re-enable conversion when only an option changes", async () => {
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: MOCK_RESULT,
    });

    render(<ConvertModule />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /convert to parquet/i }));
    await screen.findByRole("button", { name: /converted/i });

    fireEvent.click(screen.getByRole("button", { name: /gzip/i }));

    expect(screen.getByRole("button", { name: /converted/i })).toBeDisabled();
  });

  it("shows an Open in Parquet Reader action after a successful conversion", async () => {
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({
      blob: new Blob(["parquet-bytes"]),
      result: MOCK_RESULT,
    });

    render(<ConvertModule />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /convert to parquet/i }));
    await screen.findByRole("button", { name: /converted/i });

    expect(screen.getByRole("button", { name: /open in parquet reader/i })).toBeInTheDocument();
  });

  it("hands off the generated blob and navigates to the Reader module", async () => {
    const blob = new Blob(["parquet-bytes"]);
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({ blob, result: MOCK_RESULT });

    render(<ConvertModule />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /convert to parquet/i }));
    await screen.findByRole("button", { name: /converted/i });

    fireEvent.click(screen.getByRole("button", { name: /open in parquet reader/i }));

    expect(useParquetHandoffStore.getState().pending).toEqual({
      blob,
      fileName: MOCK_RESULT.fileName,
      origin: "convert",
    });
    expect(pushMock).toHaveBeenCalledWith("/tools/parquet-utility/reader");
  });

  it("keeps the conversion result and download available after navigating away and back", async () => {
    const blob = new Blob(["parquet-bytes"]);
    vi.mocked(parquetService.convertToParquet).mockResolvedValue({ blob, result: MOCK_RESULT });

    const { unmount } = render(<ConvertModule />);
    await uploadFile();
    fireEvent.click(screen.getByRole("button", { name: /convert to parquet/i }));
    await screen.findByRole("button", { name: /converted/i });

    // Simulate "Open in Parquet Reader" navigating away (unmounts the
    // Convert Files route) followed by browser Back (remounts it).
    fireEvent.click(screen.getByRole("button", { name: /open in parquet reader/i }));
    unmount();
    render(<ConvertModule />);

    expect(screen.getByRole("button", { name: /converted/i })).toBeDisabled();
    expect(screen.getByRole("link", { name: /download parquet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open in parquet reader/i })).toBeInTheDocument();
    expect(parquetService.convertToParquet).toHaveBeenCalledTimes(1);
  });
});
