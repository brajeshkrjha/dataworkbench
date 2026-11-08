"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ConversionDirectionSelector,
  type ConversionDirection,
} from "@/features/parquet/modules/convert/components/conversion-direction-selector";
import { FromParquetPanel } from "@/features/parquet/modules/convert/components/from-parquet-panel";
import { ToParquetPanel } from "@/features/parquet/modules/convert/components/to-parquet-panel";

const HELP_TEXT: Record<ConversionDirection, string> = {
  "to-parquet": "Convert CSV, JSON, Excel, TSV, XML, Avro, or ORC into a Parquet file.",
  "from-parquet": "Convert a Parquet dataset into a CSV file with configurable export options.",
};

export function ConvertModule() {
  const [direction, setDirection] = useState<ConversionDirection>("to-parquet");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Conversion direction</CardTitle>
          <CardDescription>{HELP_TEXT[direction]}</CardDescription>
        </CardHeader>
        <CardContent>
          <ConversionDirectionSelector selected={direction} onSelect={setDirection} />
        </CardContent>
      </Card>

      {direction === "to-parquet" ? <ToParquetPanel /> : <FromParquetPanel />}
    </div>
  );
}
