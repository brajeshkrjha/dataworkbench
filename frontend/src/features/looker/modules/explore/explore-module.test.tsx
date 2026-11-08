import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExploreModule } from "@/features/looker/modules/explore/explore-module";
import { lookerService } from "@/services/looker-service";
import type { PbipStructureResult } from "@/types/looker";

vi.mock("@/services/looker-service", () => ({
  lookerService: {
    explorePbipStructure: vi.fn(),
  },
}));

const MOCK_RESULT: PbipStructureResult = {
  project_name: "Sales",
  stats: {
    total_tables: 1,
    total_columns: 2,
    total_measures: 1,
    total_relationships: 0,
    total_hierarchies: 0,
    total_roles: 0,
    fact_tables: 1,
    dimension_tables: 0,
    parameter_tables: 0,
    unused_measures: 0,
    unused_tables: 0,
    complexity_score: 1.5,
  },
  tables: [
    {
      table_name: "Sales",
      classification: "fact",
      column_count: 2,
      measure_count: 1,
      hierarchy_count: 0,
      outbound_relationships: 0,
      inbound_relationships: 0,
      columns: ["Amount", "Date"],
      measures: ["Total Sales"],
      hierarchies: [],
    },
  ],
  measures: [
    {
      measure_name: "Total Sales",
      table_name: "Sales",
      expression: "SUM(Sales[Amount])",
      usage: "Used on Overview",
      used_in_tabs: ["Overview"],
      used_via_other_measures: [],
      display_folder: null,
      is_hidden: false,
    },
  ],
  relationships: [],
  roles: [],
  lineage: [],
  unused_measures: [],
  unused_tables: [],
  largest_tables: [{ table_name: "Sales", column_count: 2, measure_count: 1 }],
};

function fileWithRelativePath(relativePath: string, content = "content") {
  const file = new File([content], relativePath.split("/").pop() ?? relativePath);
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  return file;
}

function validProjectFiles() {
  return [
    fileWithRelativePath("Sales/Sales.pbip"),
    fileWithRelativePath("Sales/Sales.Report/report.json"),
    fileWithRelativePath("Sales/Sales.SemanticModel/model.tmdl"),
  ];
}

async function selectProject(files: File[]) {
  const input = screen.getByTestId("looker-file-input") as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
  await waitFor(() => expect(screen.getByText("Sales.pbip")).toBeInTheDocument());
}

beforeEach(() => {
  vi.mocked(lookerService.explorePbipStructure).mockReset();
});

describe("ExploreModule", () => {
  it("shows an empty state before any project is analyzed", () => {
    render(<ExploreModule />);
    expect(screen.getByText(/no analysis yet/i)).toBeInTheDocument();
  });

  it("disables the analyze button until a valid project is selected", async () => {
    render(<ExploreModule />);
    expect(screen.getByRole("button", { name: /analyze structure/i })).toBeDisabled();
    await selectProject(validProjectFiles());
    expect(screen.getByRole("button", { name: /analyze structure/i })).toBeEnabled();
  });

  it("renders structure tabs after a successful analysis", async () => {
    vi.mocked(lookerService.explorePbipStructure).mockResolvedValue(MOCK_RESULT);
    render(<ExploreModule />);
    await selectProject(validProjectFiles());
    fireEvent.click(screen.getByRole("button", { name: /analyze structure/i }));

    await waitFor(() => expect(screen.getByRole("tab", { name: "Tables" })).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Relationships" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Measures" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Lineage" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Statistics" })).toBeInTheDocument();
  });

  it("shows an error message when analysis fails", async () => {
    vi.mocked(lookerService.explorePbipStructure).mockRejectedValue(new Error("Analysis boom"));
    render(<ExploreModule />);
    await selectProject(validProjectFiles());
    fireEvent.click(screen.getByRole("button", { name: /analyze structure/i }));

    await waitFor(() => expect(screen.getByText("Analysis boom")).toBeInTheDocument());
  });
});
