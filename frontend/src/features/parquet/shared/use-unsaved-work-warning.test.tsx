import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useUnsavedWorkWarning } from "@/features/parquet/shared/use-unsaved-work-warning";

function TestComponent({ hasUnsavedWork }: { hasUnsavedWork: boolean }) {
  useUnsavedWorkWarning(hasUnsavedWork);
  return null;
}

function dispatchBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe("useUnsavedWorkWarning", () => {
  it("does not intercept beforeunload when there is no unsaved work", () => {
    render(<TestComponent hasUnsavedWork={false} />);

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  it("intercepts beforeunload when there is unsaved work", () => {
    render(<TestComponent hasUnsavedWork={true} />);

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(true);
  });

  it("stops intercepting once unsaved work is cleared", () => {
    const { rerender } = render(<TestComponent hasUnsavedWork={true} />);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

    rerender(<TestComponent hasUnsavedWork={false} />);

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });
});

