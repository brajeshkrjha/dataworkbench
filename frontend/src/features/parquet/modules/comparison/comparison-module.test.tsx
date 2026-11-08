import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComparisonModule } from "@/features/parquet/modules/comparison/comparison-module";
import { parquetService } from "@/services/parquet-service";
import type { SchemaComparisonResult } from "@/types/parquet";

vi.mock("@/services/parquet-service", () => ({
  parquetService: {
    compareSchemas: vi.fn(),
    exportComparisonReport: vi.fn(),
  },
}));

const MATCHING_RESULT: SchemaComparisonResult = {
  file_a: {
    file_name: "a.parquet",
    file_size_bytes: 1024,
    row_count: 10,
    column_count: 2,
    row_group_count: 1,
    compression: "snappy",
    created_by: null,
  },
  file_b: {
    file_name: "b.parquet",
    file_size_bytes: 2048,
    row_count: 12,
    column_count: 2,
    row_group_count: 1,
    compression: "snappy",
    created_by: null,
  },
  summary: {
    columns_added: 0,
    columns_removed: 0,
    columns_modified: 0,
    type_changes: 0,
    nullability_changes: 0,
    metadata_changes: 0,
    renamed_columns: 0,
    identical_columns: 2,
    total_differences: 0,
    health: "matching",
  },
  drift: {
    drift_score: 0,
    match_percentage: 100,
    explanation: "Schemas are identical - no drift detected.",
  },
  columns: [
    {
      column_name: "id",
      name_a: "id",
      name_b: "id",
      diff_type: "identical",
      risk_level: "none",
      data_type_a: "int64",
      data_type_b: "int64",
      nullable_a: false,
      nullable_b: false,
      details: [],
    },
    {
      column_name: "name",
      name_a: "name",
      name_b: "name",
      diff_type: "identical",
      risk_level: "none",
      data_type_a: "string",
      data_type_b: "string",
      nullable_a: true,
      nullable_b: true,
      details: [],
    },
  ],
};

const BREAKING_RESULT: SchemaComparisonResult = {
  ...MATCHING_RESULT,
  summary: {
    columns_added: 0,
    columns_removed: 1,
    columns_modified: 0,
    type_changes: 0,
    nullability_changes: 0,
    metadata_changes: 0,
    renamed_columns: 0,
    identical_columns: 1,
    total_differences: 1,
    health: "breaking_changes",
  },
  drift: {
    drift_score: 50,
    match_percentage: 50,
    explanation: "50% of columns are unchanged. Detected: 1 column(s) removed.",
  },
  columns: [
    MATCHING_RESULT.columns[0],
    {
      column_name: "name",
      name_a: "name",
      name_b: null,
      diff_type: "removed",
      risk_level: "high",
      data_type_a: "string",
      nullable_a: true,
      details: ["Column 'name' was removed in File B."],
    },
  ],
};

function mockFile(name: string) {
  return new File(["parquet-bytes"], name, { type: "application/octet-stream" });
}

function getFileInputs() {
  return screen.getAllByTestId("reader-file-input") as HTMLInputElement[];
}

async function uploadBothFiles() {
  const [inputA, inputB] = getFileInputs();
  fireEvent.change(inputA, { target: { files: [mockFile("a.parquet")] } });
  await waitFor(() => expect(screen.getByText("a.parquet")).toBeInTheDocument());
  fireEvent.change(inputB, { target: { files: [mockFile("b.parquet")] } });
  await waitFor(() => expect(screen.getByText("b.parquet")).toBeInTheDocument());
}

beforeEach(() => {
  vi.mocked(parquetService.compareSchemas).mockReset();
  vi.mocked(parquetService.exportComparisonReport).mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("ComparisonModule", () => {
  it("disables compare until both files are selected", async () => {
    render(<ComparisonModule />);
    expect(screen.getByRole("button", { name: /compare schemas/i })).toBeDisabled();

    await uploadBothFiles();

    expect(screen.getByRole("button", { name: /compare schemas/i })).toBeEnabled();
  });

  it("shows a matching health indicator for identical schemas", async () => {
    vi.mocked(parquetService.compareSchemas).mockResolvedValue(MATCHING_RESULT);

    render(<ComparisonModule />);
    await uploadBothFiles();
    fireEvent.click(screen.getByRole("button", { name: /compare schemas/i }));

    await screen.findByText("Matching");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows breaking changes and the removed column with high risk", async () => {
    vi.mocked(parquetService.compareSchemas).mockResolvedValue(BREAKING_RESULT);

    render(<ComparisonModule />);
    await uploadBothFiles();
    fireEvent.click(screen.getByRole("button", { name: /compare schemas/i }));

    await screen.findByText("Breaking Changes");
    const table = screen.getByRole("table");
    expect(within(table).getByText("high")).toBeInTheDocument();
  });

  it("filters to differences only by default, hiding identical columns", async () => {
    vi.mocked(parquetService.compareSchemas).mockResolvedValue(BREAKING_RESULT);

    render(<ComparisonModule />);
    await uploadBothFiles();
    fireEvent.click(screen.getByRole("button", { name: /compare schemas/i }));

    await screen.findByText("Breaking Changes");
    const table = screen.getByRole("table");
    expect(within(table).queryByText("id")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /all columns/i }));
    expect(within(table).getByText("id")).toBeInTheDocument();
  });

  it("searches by column name", async () => {
    vi.mocked(parquetService.compareSchemas).mockResolvedValue(BREAKING_RESULT);

    render(<ComparisonModule />);
    await uploadBothFiles();
    fireEvent.click(screen.getByRole("button", { name: /compare schemas/i }));

    await screen.findByText("Breaking Changes");
    fireEvent.click(screen.getByRole("button", { name: /all columns/i }));

    const search = screen.getByPlaceholderText(/search column name or data type/i);
    fireEvent.change(search, { target: { value: "name" } });

    const table = screen.getByRole("table");
    expect(within(table).queryByText("id")).not.toBeInTheDocument();
    expect(within(table).getByText("name")).toBeInTheDocument();
  });

  it("exports a report via the export buttons", async () => {
    vi.mocked(parquetService.compareSchemas).mockResolvedValue(MATCHING_RESULT);
    vi.mocked(parquetService.exportComparisonReport).mockResolvedValue(new Blob(["report"]));
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ComparisonModule />);
    await uploadBothFiles();
    fireEvent.click(screen.getByRole("button", { name: /compare schemas/i }));
    await screen.findByText("Matching");

    fireEvent.click(screen.getByRole("button", { name: /export markdown/i }));
    await waitFor(() => expect(parquetService.exportComparisonReport).toHaveBeenCalledWith(MATCHING_RESULT, "markdown"));
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("shows an error message when compare fails", async () => {
    vi.mocked(parquetService.compareSchemas).mockRejectedValue(new Error("Could not parse file"));

    render(<ComparisonModule />);
    await uploadBothFiles();
    fireEvent.click(screen.getByRole("button", { name: /compare schemas/i }));

    expect(await screen.findByText("Could not parse file")).toBeInTheDocument();
  });
});
