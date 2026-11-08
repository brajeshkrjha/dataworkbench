"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DATA_TYPE_LABELS, DATA_TYPE_OPTIONS } from "@/features/parquet/modules/convert/constants";
import { cn } from "@/lib/utils";
import type { MappedDataType, SchemaInspectionResult } from "@/types/parquet";

/**
 * Schema & Datatype Mapping (Convert Files).
 *
 * Lets users review auto-detected per-column datatypes before
 * conversion and override them individually or in bulk. Backed by a
 * format-agnostic backend engine (currently CSV/TSV); doing nothing
 * here keeps the existing automatic-inference conversion unchanged.
 */
export function SchemaMappingPanel({
  schema,
  columnOverrides,
  isInspecting,
  error,
  onSetColumnType,
  onSetAllColumnsTo,
  onResetToAutoDetect,
  disabled,
}: {
  schema: SchemaInspectionResult | null;
  columnOverrides: Record<string, MappedDataType>;
  isInspecting: boolean;
  error: string | null;
  onSetColumnType: (column: string, dataType: MappedDataType) => void;
  onSetAllColumnsTo: (dataType: MappedDataType) => void;
  onResetToAutoDetect: () => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");

  const effectiveType = (column: string, detected: MappedDataType): MappedDataType =>
    columnOverrides[column] ?? detected;

  const filteredFields = useMemo(() => {
    if (!schema) return [];
    const query = search.trim().toLowerCase();
    if (!query) return schema.fields;
    return schema.fields.filter((field) => field.name.toLowerCase().includes(query));
  }, [schema, search]);

  const overrideCount = Object.keys(columnOverrides).length;

  if (isInspecting) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Inspecting schema…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!schema) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Review and adjust detected column datatypes before generating Parquet.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Bulk actions:</span>
        {DATA_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onSetAllColumnsTo(option.value)}
            className="rounded-md border border-input px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
          >
            Set All To {option.label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || overrideCount === 0}
          onClick={onResetToAutoDetect}
          className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
        >
          <RotateCcw className="h-3 w-3" />
          Reset To Auto Detect
        </button>
        {overrideCount > 0 ? (
          <Badge variant="secondary">
            {overrideCount} override{overrideCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>

      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search columns…"
        disabled={disabled}
        className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Column Name</th>
              <th className="px-3 py-2 font-medium">Detected Type</th>
              <th className="px-3 py-2 font-medium">Sample Values</th>
              <th className="px-3 py-2 font-medium">Null %</th>
              <th className="px-3 py-2 font-medium">Selected Type</th>
            </tr>
          </thead>
          <tbody>
            {filteredFields.map((field) => {
              const selected = effectiveType(field.name, field.detectedType);
              const isOverridden = selected !== field.detectedType;
              return (
                <tr key={field.name} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{field.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {DATA_TYPE_LABELS[field.detectedType]}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {field.sampleValues.length ? field.sampleValues.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {field.nullPercentage.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={selected}
                      disabled={disabled}
                      onChange={(event) =>
                        onSetColumnType(field.name, event.target.value as MappedDataType)
                      }
                      className={cn(
                        "h-8 rounded-md border bg-background px-2 text-xs disabled:opacity-60",
                        isOverridden ? "border-primary" : "border-input"
                      )}
                    >
                      {DATA_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {filteredFields.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No columns match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {schema.previewRows.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Preview</CardTitle>
            <CardDescription>
              First {schema.previewRows.length} sampled rows, with the resulting schema applied.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  {schema.fields.map((field) => (
                    <th key={field.name} className="px-2 py-1 font-medium">
                      <div className="font-mono">{field.name}</div>
                      <div className="font-normal">
                        {DATA_TYPE_LABELS[effectiveType(field.name, field.detectedType)]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schema.previewRows.map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    {schema.fields.map((field) => (
                      <td key={field.name} className="px-2 py-1 font-mono">
                        {row[field.name] === null || row[field.name] === undefined
                          ? "—"
                          : String(row[field.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
