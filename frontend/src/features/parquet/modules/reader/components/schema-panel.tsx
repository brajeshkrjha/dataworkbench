"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ColumnSchema } from "@/types/parquet";

/** Column Explorer: searchable/filterable list of the file's schema. */
export function SchemaPanel({ columns }: { columns: ColumnSchema[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return columns;
    return columns.filter(
      (column) =>
        column.name.toLowerCase().includes(query) || column.data_type.toLowerCase().includes(query)
    );
  }, [columns, search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schema</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search columns..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No matching columns" description="Try a different search term." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Data type</th>
                  <th className="px-4 py-2 font-medium">Nullable</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((column) => (
                  <tr key={column.name} className="border-t border-border">
                    <td className="px-4 py-2 font-mono">{column.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{column.data_type}</td>
                    <td className="px-4 py-2">
                      <Badge variant={column.nullable ? "secondary" : "outline"}>
                        {column.nullable ? "Nullable" : "Required"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
