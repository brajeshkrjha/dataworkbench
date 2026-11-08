import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PreviewModule } from "@/features/looker/modules/preview/preview-module";
import { lookerService } from "@/services/looker-service";
import type { LookmlPreviewResult } from "@/types/looker";

vi.mock("@/services/looker-service", () => ({
  lookerService: {
    previewLookml: vi.fn(),
  },
}));

const MOCK_RESULT: LookmlPreviewResult = {
  project_name: "Sales",
  model_file_name: "sales.model.lkml",
  model_text: "connection: \"looker\"\ninclude: \"*.view.lkml\"",
  views: [{ view_name: "sales", table_name: "Sales", file_name: "sales.view.lkml", lookml: "view: sales {}" }],
  explores: [
    { explore_name: "sales", table_name: "Sales", file_name: "sales.explore.lkml", join_count: 0, lookml: "explore: sales {}" },
  ],
  counts: { views: 1, explores: 1 },
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
  vi.mocked(lookerService.previewLookml).mockReset();
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("PreviewModule", () => {
  it("shows an empty state before any preview is generated", () => {
    render(<PreviewModule />);
    expect(screen.getByText(/no preview yet/i)).toBeInTheDocument();
  });

  it("disables the generate button until a valid project is selected", async () => {
    render(<PreviewModule />);
    expect(screen.getByRole("button", { name: /generate preview/i })).toBeDisabled();
    await selectProject(validProjectFiles());
    expect(screen.getByRole("button", { name: /generate preview/i })).toBeEnabled();
  });

  it("renders the project explorer and code viewer after a successful preview", async () => {
    vi.mocked(lookerService.previewLookml).mockResolvedValue(MOCK_RESULT);
    render(<PreviewModule />);
    await selectProject(validProjectFiles());
    fireEvent.click(screen.getByRole("button", { name: /generate preview/i }));

    await waitFor(() => expect(screen.getByText("Project Explorer")).toBeInTheDocument());
    expect(screen.getAllByText("sales.model.lkml").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 views/i)).toBeInTheDocument();
    expect(screen.getByText(/1 explores/i)).toBeInTheDocument();
  });

  it("shows an error message when preview generation fails", async () => {
    vi.mocked(lookerService.previewLookml).mockRejectedValue(new Error("Preview boom"));
    render(<PreviewModule />);
    await selectProject(validProjectFiles());
    fireEvent.click(screen.getByRole("button", { name: /generate preview/i }));

    await waitFor(() => expect(screen.getByText("Preview boom")).toBeInTheDocument());
  });
});
