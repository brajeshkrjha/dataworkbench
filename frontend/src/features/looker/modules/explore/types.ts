/**
 * Local, narrow shapes for the Explore PBIP Structure payload — the
 * generated OpenAPI types keep these as Record<string, unknown>[] since
 * the backend types them as list[dict[str, Any]]; these interfaces mirror
 * structure_explorer.py's actual field names so components get real
 * autocomplete/type-checking instead of `unknown` everywhere.
 */
export interface ExploreTable {
  table_name: string;
  classification: "fact" | "dimension" | "parameter";
  column_count: number;
  measure_count: number;
  hierarchy_count: number;
  outbound_relationships: number;
  inbound_relationships: number;
  columns: string[];
  measures: string[];
  hierarchies: string[];
}

export interface ExploreMeasure {
  measure_name: string;
  table_name: string;
  expression: string | null;
  usage: string | null;
  used_in_tabs: string[];
  used_via_other_measures: string[];
  display_folder: string | null;
  is_hidden: boolean | null;
}

export interface ExploreRelationship {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  cardinality: string | null;
  cardinality_symbol: string | null;
  status: string | null;
  filter_direction: string | null;
  notes: string | null;
}

export interface ExploreRole {
  role_name: string;
  model_permission: string | null;
  tables_filtered: string[];
  filter_count: number | null;
}

export interface ExploreLineageEntry {
  tab: string;
  visual_index: number | null;
  fields: { field_or_measure: string; table_name: string }[];
  relationships: ExploreRelationship[];
}

export interface ExploreLargestTable {
  table_name: string;
  column_count: number;
  measure_count: number;
}
