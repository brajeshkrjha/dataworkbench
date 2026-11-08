/**
 * Types mirroring `app/schemas/text_compare.py` on the backend.
 */
export type ComparisonInputType = "text" | "csv" | "json" | "xml" | "yaml" | "sql" | "lookml" | "dax";

export type DiffType = "added" | "removed" | "modified" | "identical";

export type RiskLevel = "high" | "medium" | "low" | "none";

export interface LineDiff {
  line_number_a: number | null;
  line_number_b: number | null;
  diff_type: DiffType;
  content_a: string | null;
  content_b: string | null;
}

export interface TextComparisonDetail {
  lines: LineDiff[];
}

export interface StructuredDiffEntry {
  path: string;
  diff_type: DiffType;
  value_a: string | null;
  value_b: string | null;
}

export interface StructuredComparisonDetail {
  keys_added: number;
  keys_removed: number;
  values_changed: number;
  array_changes: number;
  entries: StructuredDiffEntry[];
}

export interface CsvRowDiff {
  row_index: number;
  diff_type: DiffType;
  row_a: Record<string, string> | null;
  row_b: Record<string, string> | null;
  changed_columns: string[];
}

export interface CsvComparisonDetail {
  row_count_a: number;
  row_count_b: number;
  column_count_a: number;
  column_count_b: number;
  columns_added: string[];
  columns_removed: string[];
  rows_added: number;
  rows_removed: number;
  rows_modified: number;
  rows_identical: number;
  rows: CsvRowDiff[];
}

export interface SqlDiffEntry {
  category: string;
  diff_type: DiffType;
  detail: string;
}

export interface SqlComparisonDetail {
  tables_added: string[];
  tables_removed: string[];
  joins_added: string[];
  joins_removed: string[];
  filters_added: string[];
  filters_removed: string[];
  columns_added: string[];
  columns_removed: string[];
  entries: SqlDiffEntry[];
}

export interface ComparisonSummary {
  similarity_score: number;
  added_count: number;
  removed_count: number;
  modified_count: number;
  identical_count: number;
  total_differences: number;
  risk_level: RiskLevel;
}

export interface ComparisonResult {
  input_type: ComparisonInputType;
  detected_type_a: ComparisonInputType;
  detected_type_b: ComparisonInputType;
  file_name_a: string;
  file_name_b: string;
  summary: ComparisonSummary;
  text_detail: TextComparisonDetail;
  structured_detail: StructuredComparisonDetail | null;
  csv_detail: CsvComparisonDetail | null;
  sql_detail: SqlComparisonDetail | null;
}

export type ComparisonExportFormat = "markdown" | "csv";

export type ComparisonInputMethod = "upload" | "paste";
