import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConvertModule } from "@/features/looker/modules/convert/convert-module";
import { lookerService } from "@/services/looker-service";
import type { LookerConversionResult } from "@/types/looker";

vi.mock("@/services/looker-service", () => ({
  lookerService: {
    convertPbipToLookml: vi.fn(),
  },
}));

const MOCK_RESULT: LookerConversionResult = {
  projectName: "Sales",
  outputFileName: "Sales_LookML_2026-09-29_1200.zip",
  viewsGenerated: 4,
  exploresGenerated: 1,
  relationshipsFound: 3,
  measuresFound: 5,
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

function incompleteProjectFiles() {
  return [fileWithRelativePath("Sales/Sales.pbip"), fileWithRelativePath("Sales/notes.txt")];
}

function lonePbipFile() {
  return [fileWithRelativePath("Sales/Sales.pbip")];
}

function getFileInput() {
  return screen.getByTestId("looker-file-input") as HTMLInputElement;
}

async function selectProject(files: File[]) {
  const input = getFileInput();
  fireEvent.change(input, { target: { files } });
  await waitFor(() => expect(screen.getByText("Sales.pbip")).toBeInTheDocument());
}

beforeEach(() => {
  vi.mocked(lookerService.convertPbipToLookml).mockReset();
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("ConvertModule", () => {
  it("disables the generate button until a valid project is selected", async () => {
    render(<ConvertModule />);
    expect(screen.getByRole("button", { name: /generate lookml package/i })).toBeDisabled();

    await selectProject(validProjectFiles());
    expect(screen.getByRole("button", { name: /generate lookml package/i })).toBeEnabled();
  });

  it("shows validation checks after a project is selected", async () => {
    render(<ConvertModule />);
    await selectProject(validProjectFiles());

    expect(screen.getByText(/pbip found/i)).toBeInTheDocument();
    expect(screen.getByText(/report assets found/i)).toBeInTheDocument();
    expect(screen.getByText(/semantic model found/i)).toBeInTheDocument();
  });

  it("shows validation failures and keeps the generate button disabled", async () => {
    render(<ConvertModule />);
    await selectProject(incompleteProjectFiles());

    await waitFor(() =>
      expect(screen.getByText(/required project assets not found/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /generate lookml package/i })).toBeDisabled();
  });

  it("rejects a lone .pbip file with guidance to select its folder instead", async () => {
    render(<ConvertModule />);
    const input = getFileInput();
    fireEvent.change(input, { target: { files: lonePbipFile() } });

    await waitFor(() =>
      expect(screen.getByText(/only the \.pbip file itself was dropped/i)).toBeInTheDocument()
    );
    expect(screen.queryByText("Sales.pbip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate lookml package/i })).toBeDisabled();
  });

  it("never surfaces ZIP, Report folder, or SemanticModel folder terminology", async () => {
    render(<ConvertModule />);
    await selectProject(validProjectFiles());

    expect(screen.queryByText(/\bzip\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/report folder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/semanticmodel folder/i)).not.toBeInTheDocument();
  });

  it("disables and relabels the button after a successful conversion", async () => {
    vi.mocked(lookerService.convertPbipToLookml).mockResolvedValue({
      blob: new Blob(["zip-bytes"]),
      result: MOCK_RESULT,
    });

    render(<ConvertModule />);
    await selectProject(validProjectFiles());
    fireEvent.click(screen.getByRole("button", { name: /generate lookml package/i }));

    const completedButton = await screen.findByRole("button", { name: /^generated$/i });
    expect(completedButton).toBeDisabled();
    expect(lookerService.convertPbipToLookml).toHaveBeenCalledTimes(1);
  });

  it("renders the result panel with conversion statistics and a download link", async () => {
    vi.mocked(lookerService.convertPbipToLookml).mockResolvedValue({
      blob: new Blob(["zip-bytes"]),
      result: MOCK_RESULT,
    });

    render(<ConvertModule />);
    await selectProject(validProjectFiles());
    fireEvent.click(screen.getByRole("button", { name: /generate lookml package/i }));
    await screen.findByRole("button", { name: /^generated$/i });

    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    const downloadLink = screen.getByRole("link", { name: /download lookml package/i });
    expect(downloadLink).toHaveAttribute("href", "blob:mock-url");
  });

  it("shows an error state when the backend rejects the project", async () => {
    vi.mocked(lookerService.convertPbipToLookml).mockRejectedValue(
      new Error("No 'Sales.Report' folder was found next to the .pbip file.")
    );

    render(<ConvertModule />);
    await selectProject(validProjectFiles());
    fireEvent.click(screen.getByRole("button", { name: /generate lookml package/i }));

    await waitFor(() => expect(screen.getByText(/conversion failed/i)).toBeInTheDocument());
    expect(screen.getByText(/no 'sales.report' folder was found/i)).toBeInTheDocument();
  });

  it("resets to the empty state", async () => {
    render(<ConvertModule />);
    await selectProject(validProjectFiles());

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(screen.getByText(/no conversion yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate lookml package/i })).toBeDisabled();
  });
});
