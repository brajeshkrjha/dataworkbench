import { beforeEach, describe, expect, it } from "vitest";

import { useParquetHandoffStore } from "@/store/use-parquet-handoff-store";

describe("useParquetHandoffStore", () => {
  beforeEach(() => {
    useParquetHandoffStore.setState({ pending: null });
  });

  it("has no pending handoff by default", () => {
    expect(useParquetHandoffStore.getState().consumePending()).toBeNull();
  });

  it("stores and consumes a pending file exactly once", () => {
    const blob = new Blob(["parquet-bytes"]);
    useParquetHandoffStore.getState().setPending({
      blob,
      fileName: "sales.parquet",
      origin: "convert",
    });

    const first = useParquetHandoffStore.getState().consumePending();
    expect(first).toEqual({ blob, fileName: "sales.parquet", origin: "convert" });

    const second = useParquetHandoffStore.getState().consumePending();
    expect(second).toBeNull();
  });
});
