import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompareModule } from "@/features/looker/modules/compare/compare-module";
import { lookerService } from "@/services/looker-service";
import type { LookmlCompareResult } from "@/types/looker";

vi.mock("@/services/looker-service", () => ({
  lookerService: {
    compareLookmlPackages: vi.fn(),
  },
}));

const MOCK_RESULT: LookmlCompareResult = {
  project_name_a: "Sales_v1",
  project_name_b: "Sales_v2",
  source_type_a: "pbip_project",
  source_type_b: "pbip_project",
  summary: {
    views_added: 0,
    views_removed: 1,
    views_changed: 0,
    explores_added: 0,
    explores_removed: 0,
    explores_changed: 0,
  },
  views_added: [],
  views_removed: ["region"],
  view_changes: [],
  explores_added: [],
  explores_removed: [],
  explore_changes: [],
  risk_flags: ["View 'region' was removed - any Looker content referencing it will break."],
};

const MOCK_MIXED_RESULT: LookmlCompareResult = {
  ...MOCK_RESULT,
  project_name_a: "Sales",
  project_name_b: "Sales_LookML",
  source_type_a: "pbip_project",
  source_type_b: "lookml_package",
  views_removed: [],
  risk_flags: [],
  summary: { ...MOCK_RESULT.summary, views_removed: 0 },
};

function fileWithRelativePath(relativePath: string, content = "content") {
  const file = new File([content], relativePath.split("/").pop() ?? relativePath);
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  return file;
}

function validProjectFiles(root: string) {
  return [
    fileWithRelativePath(`${root}/${root}.pbip`),
    fileWithRelativePath(`${root}/${root}.Report/report.json`),
    fileWithRelativePath(`${root}/${root}.SemanticModel/model.tmdl`),
  ];
}

async function selectProject(input: HTMLInputElement, files: File[], expectedLabel: string) {
  fireEvent.change(input, { target: { files } });
  await waitFor(() => expect(screen.getByText(expectedLabel)).toBeInTheDocument());
}

async function selectZip(input: HTMLInputElement, fileName: string) {
  const file = new File(["zip-bytes"], fileName);
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText(fileName)).toBeInTheDocument());
}

beforeEach(() => {
  vi.mocked(lookerService.compareLookmlPackages).mockReset();
});

describe("CompareModule", () => {
  it("shows an empty state before any comparison runs", () => {
    render(<CompareModule />);
    expect(screen.getByText(/no comparison yet/i)).toBeInTheDocument();
  });

  it("disables the compare button until both projects are selected", async () => {
    render(<CompareModule />);
    const inputs = screen.getAllByTestId("compare-folder-input") as HTMLInputElement[];
    expect(screen.getByRole("button", { name: /compare packages/i })).toBeDisabled();

    await selectProject(inputs[0], validProjectFiles("PackageA"), "PackageA.pbip");
    expect(screen.getByRole("button", { name: /compare packages/i })).toBeDisabled();

    await selectProject(inputs[1], validProjectFiles("PackageB"), "PackageB.pbip");
    expect(screen.getByRole("button", { name: /compare packages/i })).toBeEnabled();
  });

  it("renders the diff summary and risk flags after a successful comparison", async () => {
    vi.mocked(lookerService.compareLookmlPackages).mockResolvedValue(MOCK_RESULT);
    render(<CompareModule />);
    const inputs = screen.getAllByTestId("compare-folder-input") as HTMLInputElement[];
    await selectProject(inputs[0], validProjectFiles("PackageA"), "PackageA.pbip");
    await selectProject(inputs[1], validProjectFiles("PackageB"), "PackageB.pbip");
    fireEvent.click(screen.getByRole("button", { name: /compare packages/i }));

    await waitFor(() => expect(screen.getByText(/risk flags/i)).toBeInTheDocument());
    expect(screen.getByText(/region.*will break/i)).toBeInTheDocument();
    const viewsCard = screen.getByText("Views").closest("div")?.parentElement as HTMLElement;
    expect(within(viewsCard).getByText("- region")).toBeInTheDocument();
    expect(screen.getByText("Source A: Type / Name")).toBeInTheDocument();
    expect(screen.getByText("Source B: Type / Name")).toBeInTheDocument();
    expect(screen.getAllByText(/PBIP Project/).length).toBeGreaterThanOrEqual(2);
  });

  it("shows an error message when comparison fails", async () => {
    vi.mocked(lookerService.compareLookmlPackages).mockRejectedValue(new Error("Compare boom"));
    render(<CompareModule />);
    const inputs = screen.getAllByTestId("compare-folder-input") as HTMLInputElement[];
    await selectProject(inputs[0], validProjectFiles("PackageA"), "PackageA.pbip");
    await selectProject(inputs[1], validProjectFiles("PackageB"), "PackageB.pbip");
    fireEvent.click(screen.getByRole("button", { name: /compare packages/i }));

    await waitFor(() => expect(screen.getByText("Compare boom")).toBeInTheDocument());
  });

  it("accepts a LookML package .zip file directly for either side", async () => {
    vi.mocked(lookerService.compareLookmlPackages).mockResolvedValue(MOCK_MIXED_RESULT);
    render(<CompareModule />);
    const folderInputs = screen.getAllByTestId("compare-folder-input") as HTMLInputElement[];
    const zipInputs = screen.getAllByTestId("compare-zip-input") as HTMLInputElement[];

    await selectProject(folderInputs[0], validProjectFiles("Sales"), "Sales.pbip");
    await selectZip(zipInputs[1], "Sales_LookML.zip");

    expect(screen.getByRole("button", { name: /compare packages/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /compare packages/i }));

    await waitFor(() => expect(lookerService.compareLookmlPackages).toHaveBeenCalled());
    const [, nameA, , nameB] = vi.mocked(lookerService.compareLookmlPackages).mock.calls[0];
    expect(nameA).toBe("Sales.zip");
    expect(nameB).toBe("Sales_LookML.zip");

    await waitFor(() => expect(screen.getByText("Source A: Type / Name")).toBeInTheDocument());
    expect(screen.getByText(/PBIP Project/)).toBeInTheDocument();
    expect(screen.getByText(/LookML Package/)).toBeInTheDocument();
  });
});

