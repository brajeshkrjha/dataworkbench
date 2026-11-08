import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Example({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <Tabs defaultValue="first" onValueChange={onValueChange}>
      <TabsList>
        <TabsTrigger value="first">First</TabsTrigger>
        <TabsTrigger value="second">Second</TabsTrigger>
        <TabsTrigger value="third">Third</TabsTrigger>
      </TabsList>
      <TabsContent value="first">First content</TabsContent>
      <TabsContent value="second">Second content</TabsContent>
      <TabsContent value="third">Third content</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("associates the selected tab with its panel and keeps inactive contents unmounted", () => {
    render(<Example />);
    const first = screen.getByRole("tab", { name: "First" });
    const panel = screen.getByRole("tabpanel", { name: "First" });
    expect(first).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", first.id);
    expect(first).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Second" })).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByText("Second content")).not.toBeInTheDocument();
  });

  it("moves focus with arrows/Home/End without activating lazy tabs", () => {
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);
    const [first, second, third] = screen.getAllByRole("tab");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveFocus();
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(second, { key: "End" });
    expect(third).toHaveFocus();
    fireEvent.keyDown(third, { key: "ArrowRight" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(third).toHaveFocus();
    fireEvent.keyDown(third, { key: "Home" });
    expect(first).toHaveFocus();
  });

  it("keeps click activation and onValueChange behavior unchanged", () => {
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Second" }));
    expect(onValueChange).toHaveBeenCalledWith("second");
    expect(screen.getByRole("tabpanel", { name: "Second" })).toHaveTextContent("Second content");
    expect(screen.queryByText("First content")).not.toBeInTheDocument();
  });

  it("gives independent tab sets unique control IDs", () => {
    render(<><Example /><Example /></>);
    const ids = screen.getAllByRole("tab").map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});