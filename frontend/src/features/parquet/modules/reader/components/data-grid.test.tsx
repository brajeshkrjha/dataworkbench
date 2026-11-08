import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataGrid } from "@/features/parquet/modules/reader/components/data-grid";

describe("DataGrid accessibility", () => {
  it("announces sort order while preserving the existing ascending/descending/unsorted cycle", () => {
    render(<DataGrid columns={[{ name: "id", data_type: "int64", nullable: false }]} rows={[{ id: 2 }, { id: 1 }]} offset={0} limit={100} totalRowCount={2} isLoadingRows={false} onPageChange={vi.fn()} onLimitChange={vi.fn()} />);
    const header = screen.getByRole("columnheader", { name: "id" });
    const button = within(header).getByRole("button");
    const values = () => screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(header).toHaveAttribute("aria-sort", "none");
    fireEvent.click(button);
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(values()).toEqual(["1", "2"]);
    fireEvent.click(button);
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(values()).toEqual(["2", "1"]);
    fireEvent.click(button);
    expect(header).toHaveAttribute("aria-sort", "none");
    expect(screen.getByRole("textbox", { name: "Search displayed rows" })).toBeInTheDocument();
  });
});