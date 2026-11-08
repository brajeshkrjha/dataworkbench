"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  ExploreLargestTable,
  ExploreLineageEntry,
  ExploreMeasure,
  ExploreRelationship,
  ExploreRole,
  ExploreTable,
} from "@/features/looker/modules/explore/types";
import { useFilteredList } from "@/hooks/use-filtered-list";
import type { PbipStructureStats } from "@/types/looker";

const PAGE_SIZE = 50;

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function OverviewPanel({ stats }: { stats: PbipStructureStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <StatTile label="Tables" value={stats.total_tables} />
      <StatTile label="Columns" value={stats.total_columns} />
      <StatTile label="Measures" value={stats.total_measures} />
      <StatTile label="Relationships" value={stats.total_relationships} />
      <StatTile label="Hierarchies" value={stats.total_hierarchies} />
      <StatTile label="Roles" value={stats.total_roles} />
      <StatTile label="Fact tables" value={stats.fact_tables} />
      <StatTile label="Dimension tables" value={stats.dimension_tables} />
      <StatTile label="Parameter tables" value={stats.parameter_tables} />
      <StatTile label="Unused measures" value={stats.unused_measures} />
      <StatTile label="Unused tables" value={stats.unused_tables} />
      <StatTile label="Complexity score" value={stats.complexity_score} />
    </div>
  );
}

const matchesTable = (table: ExploreTable, query: string) =>
  table.table_name.toLowerCase().includes(query) || table.columns.some((column) => column.toLowerCase().includes(query));
const matchesRelationship = (relationship: ExploreRelationship, query: string) =>
  relationship.from_table.toLowerCase().includes(query) || relationship.to_table.toLowerCase().includes(query);
const matchesMeasure = (measure: ExploreMeasure, query: string) =>
  measure.measure_name.toLowerCase().includes(query) || measure.table_name.toLowerCase().includes(query);
const matchesLineage = (entry: ExploreLineageEntry, query: string) =>
  entry.tab.toLowerCase().includes(query) || entry.fields.some((field) => field.field_or_measure.toLowerCase().includes(query));

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 w-full max-w-xs rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function ShowMore({ shown, total, onShowMore }: { shown: number; total: number; onShowMore: () => void }) {
  if (shown >= total) return null;
  return (
    <button
      type="button"
      onClick={onShowMore}
      className="mt-3 w-full rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground"
    >
      Show more ({total - shown} remaining)
    </button>
  );
}

const CLASSIFICATION_LABEL: Record<ExploreTable["classification"], string> = {
  fact: "Fact",
  dimension: "Dimension",
  parameter: "Parameter",
};

export function TableExplorer({ tables }: { tables: ExploreTable[] }) {
  const [filter, setFilter] = useState<"all" | ExploreTable["classification"]>("all");
  const filteredByKind = useMemo(
    () => (filter === "all" ? tables : tables.filter((t) => t.classification === filter)),
    [tables, filter]
  );
  const { query, setQuery, filtered, visible, setVisibleCount } = useFilteredList(filteredByKind, matchesTable, PAGE_SIZE);

  if (tables.length === 0) {
    return <EmptyState title="No tables found" description="This project has no detected tables." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {(["all", "fact", "dimension", "parameter"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setFilter(kind);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                filter === kind ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {kind === "all" ? "All" : CLASSIFICATION_LABEL[kind]}
            </button>
          ))}
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search tables or columns" />
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {tables.length} tables
      </p>
      <div className="flex flex-col gap-2">
        {visible.map((table) => (
          <div key={table.table_name} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-medium">{table.table_name}</p>
              <Badge variant="secondary">{CLASSIFICATION_LABEL[table.classification]}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{table.column_count} columns</span>
              <span>{table.measure_count} measures</span>
              <span>{table.hierarchy_count} hierarchies</span>
              <span>{table.outbound_relationships} outbound relationships</span>
              <span>{table.inbound_relationships} inbound relationships</span>
            </div>
          </div>
        ))}
      </div>
      <ShowMore shown={visible.length} total={filtered.length} onShowMore={() => setVisibleCount((c) => c + PAGE_SIZE)} />
    </div>
  );
}

export function RelationshipExplorer({ relationships }: { relationships: ExploreRelationship[] }) {
  const { query, setQuery, filtered, visible, setVisibleCount } = useFilteredList(relationships, matchesRelationship, PAGE_SIZE);

  if (relationships.length === 0) {
    return <EmptyState title="No relationships found" description="This project has no detected table relationships." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Search by table name" />
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {relationships.length} relationships
      </p>
      <div className="flex flex-col gap-2">
        {visible.map((rel, index) => (
          <div key={index} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span>{rel.from_table}.{rel.from_column}</span>
              <span className="text-muted-foreground">{rel.cardinality_symbol ?? "→"}</span>
              <span>{rel.to_table}.{rel.to_column}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {rel.cardinality ? <Badge variant="outline">{rel.cardinality}</Badge> : null}
              {rel.filter_direction ? <Badge variant="outline">{rel.filter_direction}</Badge> : null}
              {rel.status ? <Badge variant={rel.status.toLowerCase().includes("active") ? "default" : "secondary"}>{rel.status}</Badge> : null}
              {rel.notes ? <span>{rel.notes}</span> : null}
            </div>
          </div>
        ))}
      </div>
      <ShowMore shown={visible.length} total={filtered.length} onShowMore={() => setVisibleCount((c) => c + PAGE_SIZE)} />
    </div>
  );
}

export function MeasureExplorer({ measures }: { measures: ExploreMeasure[] }) {
  const { query, setQuery, filtered, visible, setVisibleCount } = useFilteredList(measures, matchesMeasure, PAGE_SIZE);

  if (measures.length === 0) {
    return <EmptyState title="No measures found" description="This project has no detected measures." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Search measures or tables" />
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {measures.length} measures
      </p>
      <div className="flex flex-col gap-2">
        {visible.map((measure) => (
          <div key={`${measure.table_name}.${measure.measure_name}`} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-medium">
                {measure.table_name}.{measure.measure_name}
              </p>
              <Badge variant={measure.usage === "Not on any page" ? "secondary" : "default"}>
                {measure.usage ?? "Usage unknown"}
              </Badge>
            </div>
            {measure.expression ? (
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-xs">{measure.expression}</pre>
            ) : null}
            {measure.used_in_tabs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {measure.used_in_tabs.map((tab) => (
                  <Badge key={tab} variant="outline">
                    {tab}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <ShowMore shown={visible.length} total={filtered.length} onShowMore={() => setVisibleCount((c) => c + PAGE_SIZE)} />
    </div>
  );
}

export function LineageViewer({ lineage }: { lineage: ExploreLineageEntry[] }) {
  const { query, setQuery, filtered, visible, setVisibleCount } = useFilteredList(lineage, matchesLineage, PAGE_SIZE);

  if (lineage.length === 0) {
    return <EmptyState title="No lineage data" description="No report visuals reference model fields in this project." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Search by tab or field" />
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {lineage.length} visuals
      </p>
      <div className="flex flex-col gap-2">
        {visible.map((entry, index) => (
          <div key={index} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">
              {entry.tab || "Untitled tab"} · Visual {entry.visual_index ?? "—"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
              {entry.fields.map((field, fieldIndex) => (
                <span key={fieldIndex} className="flex items-center gap-1">
                  <Badge variant="outline">
                    {field.table_name}.{field.field_or_measure}
                  </Badge>
                  {fieldIndex < entry.fields.length - 1 ? <span className="text-muted-foreground">→</span> : null}
                </span>
              ))}
            </div>
            {entry.relationships.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Related relationships: {entry.relationships.map((r) => `${r.from_table}→${r.to_table}`).join(", ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <ShowMore shown={visible.length} total={filtered.length} onShowMore={() => setVisibleCount((c) => c + PAGE_SIZE)} />
    </div>
  );
}

export function StatisticsPanel({
  unusedMeasures,
  unusedTables,
  largestTables,
  roles,
}: {
  unusedMeasures: string[];
  unusedTables: string[];
  largestTables: ExploreLargestTable[];
  roles: ExploreRole[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Largest tables</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {largestTables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tables found.</p>
          ) : (
            largestTables.map((table) => (
              <div key={table.table_name} className="flex items-center justify-between text-sm">
                <span className="font-mono">{table.table_name}</span>
                <span className="text-xs text-muted-foreground">
                  {table.column_count} columns · {table.measure_count} measures
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security roles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No row-level security roles defined.</p>
          ) : (
            roles.map((role) => (
              <div key={role.role_name} className="text-sm">
                <p className="font-medium">{role.role_name}</p>
                <p className="text-xs text-muted-foreground">
                  {role.model_permission ?? "—"} · {role.filter_count ?? 0} filters ·{" "}
                  {role.tables_filtered.join(", ") || "no tables filtered"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unused measures ({unusedMeasures.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {unusedMeasures.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every measure is referenced by at least one report visual.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {unusedMeasures.slice(0, 100).map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unused tables ({unusedTables.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {unusedTables.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every table is referenced by at least one report visual.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {unusedTables.slice(0, 100).map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
