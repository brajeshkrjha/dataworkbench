"""Schema Comparison: diffs two parquet files' schemas (never row data) to
surface structural drift and breaking-change risk between two dataset
versions - e.g. "does yesterday's file still match today's contract?".

Stateless by design: unlike the Reader/Analyzer, there is no session to
keep alive - both files are parsed once, a full result is computed, and
the temp files are deleted immediately. This keeps memory bounded even
with hundreds of columns since only footer metadata (never row data) is
read.
"""
import difflib
from contextlib import ExitStack
from pathlib import Path

import pyarrow.parquet as pq

from app.core.exceptions import FileParseError
from app.schemas.parquet import (
    ColumnDiff,
    ComparisonSummary,
    ParquetFileMetadata,
    RiskLevel,
    SchemaComparisonResult,
    SchemaDiffType,
    SchemaDriftAnalysis,
    SchemaHealth,
)

_RENAME_SIMILARITY_THRESHOLD = 0.6
"""Minimum name-similarity ratio to treat an added+removed pair as a rename
rather than two unrelated changes."""


class _FieldInfo:
    __slots__ = ("data_type", "encoding", "metadata", "name", "nullable", "position")

    def __init__(
        self,
        name: str,
        data_type: str,
        nullable: bool,
        metadata: dict[str, str] | None,
        encoding: str | None,
        position: int,
    ) -> None:
        self.name = name
        self.data_type = data_type
        self.nullable = nullable
        self.metadata = metadata
        self.encoding = encoding
        self.position = position


def _decode_metadata(raw: dict[bytes, bytes] | None) -> dict[str, str] | None:
    if not raw:
        return None
    decoded: dict[str, str] = {}
    for key, value in raw.items():
        try:
            decoded[key.decode("utf-8")] = value.decode("utf-8")
        except UnicodeDecodeError:
            decoded[key.decode("utf-8", errors="replace")] = value.decode("utf-8", errors="replace")
    return decoded or None


class ParquetSchemaComparisonService:
    """Reads two parquet files' footers and produces a full structural diff."""

    def compare(
        self,
        path_a: Path,
        name_a: str,
        path_b: Path,
        name_b: str,
        include_order_changes: bool = False,
    ) -> SchemaComparisonResult:
        file_a = self._read_file_info(path_a, name_a)
        file_b = self._read_file_info(path_b, name_b)

        columns = self._diff_fields(file_a.fields, file_b.fields, include_order_changes)
        summary = self._summarize(columns)
        drift = self._analyze_drift(columns, summary)

        return SchemaComparisonResult(
            file_a=file_a.metadata,
            file_b=file_b.metadata,
            summary=summary,
            drift=drift,
            columns=columns,
        )

    class _FileInfo:
        __slots__ = ("fields", "metadata")

        def __init__(self, fields: dict[str, _FieldInfo], metadata: ParquetFileMetadata) -> None:
            self.fields = fields
            self.metadata = metadata

    def _read_file_info(self, path: Path, file_name: str) -> "ParquetSchemaComparisonService._FileInfo":
        # Extract the small schema snapshot while handles are scoped. Neither
        # successful comparisons nor failures should rely on GC to unlock files.
        with ExitStack() as stack:
            try:
                handle = stack.enter_context(path.open("rb"))
                parquet_file = stack.enter_context(pq.ParquetFile(handle))
            except Exception as exc:
                raise FileParseError(file_name, str(exc)) from exc

            metadata = parquet_file.metadata
            compression = None
            if metadata.num_row_groups > 0 and metadata.row_group(0).num_columns > 0:
                compression = metadata.row_group(0).column(0).compression

            file_metadata = ParquetFileMetadata(
                file_name=file_name,
                file_size_bytes=path.stat().st_size,
                row_count=metadata.num_rows,
                column_count=metadata.num_columns,
                row_group_count=metadata.num_row_groups,
                compression=compression,
                created_by=metadata.created_by,
            )
            return ParquetSchemaComparisonService._FileInfo(
                self._extract_fields(parquet_file), file_metadata
            )

    def _extract_fields(self, parquet_file: pq.ParquetFile) -> dict[str, _FieldInfo]:
        schema = parquet_file.schema_arrow
        row_group_meta = parquet_file.metadata.row_group(0) if parquet_file.metadata.num_row_groups > 0 else None

        fields: dict[str, _FieldInfo] = {}
        for index, field in enumerate(schema):
            encoding = None
            if row_group_meta is not None and index < row_group_meta.num_columns:
                encoding = row_group_meta.column(index).compression
            fields[field.name] = _FieldInfo(
                name=field.name,
                data_type=str(field.type),
                nullable=field.nullable,
                metadata=_decode_metadata(field.metadata),
                encoding=encoding,
                position=index,
            )
        return fields

    def _diff_fields(
        self,
        fields_a: dict[str, _FieldInfo],
        fields_b: dict[str, _FieldInfo],
        include_order_changes: bool,
    ) -> list[ColumnDiff]:
        names_a = set(fields_a)
        names_b = set(fields_b)
        matched = names_a & names_b
        only_a = names_a - names_b
        only_b = names_b - names_a

        renamed_pairs, unmatched_a, unmatched_b = self._match_renames(fields_a, only_a, fields_b, only_b)

        columns: list[ColumnDiff] = []

        for name in sorted(matched, key=lambda n: fields_a[n].position):
            columns.append(self._diff_matched(fields_a[name], fields_b[name], include_order_changes))

        for old_name, new_name, similarity in renamed_pairs:
            columns.append(self._diff_renamed(fields_a[old_name], fields_b[new_name], similarity))

        for name in sorted(unmatched_a, key=lambda n: fields_a[n].position):
            columns.append(self._diff_removed(fields_a[name]))

        for name in sorted(unmatched_b, key=lambda n: fields_b[n].position):
            columns.append(self._diff_added(fields_b[name]))

        return columns

    def _match_renames(
        self,
        fields_a: dict[str, _FieldInfo],
        only_a: set[str],
        fields_b: dict[str, _FieldInfo],
        only_b: set[str],
    ) -> tuple[list[tuple[str, str, float]], set[str], set[str]]:
        """Best-effort rename detection: pairs a removed name with an added
        name when they share a data type and their names are similar
        enough, greedily taking the best-scoring pair each time."""
        candidates: list[tuple[float, str, str]] = []
        for name_a in only_a:
            for name_b in only_b:
                if fields_a[name_a].data_type != fields_b[name_b].data_type:
                    continue
                ratio = difflib.SequenceMatcher(None, name_a, name_b).ratio()
                if ratio >= _RENAME_SIMILARITY_THRESHOLD:
                    candidates.append((ratio, name_a, name_b))

        candidates.sort(key=lambda item: item[0], reverse=True)

        used_a: set[str] = set()
        used_b: set[str] = set()
        pairs: list[tuple[str, str, float]] = []
        for ratio, name_a, name_b in candidates:
            if name_a in used_a or name_b in used_b:
                continue
            used_a.add(name_a)
            used_b.add(name_b)
            pairs.append((name_a, name_b, ratio))

        remaining_a = only_a - used_a
        remaining_b = only_b - used_b
        return pairs, remaining_a, remaining_b

    def _diff_matched(self, field_a: _FieldInfo, field_b: _FieldInfo, include_order_changes: bool) -> ColumnDiff:
        details: list[str] = []
        diff_type = SchemaDiffType.IDENTICAL
        risk = RiskLevel.NONE

        if field_a.data_type != field_b.data_type:
            details.append(f"Data type changed from '{field_a.data_type}' to '{field_b.data_type}'.")
            diff_type = SchemaDiffType.TYPE_CHANGED
            risk = RiskLevel.HIGH

        if field_a.nullable != field_b.nullable:
            details.append(
                f"Nullability changed from {'nullable' if field_a.nullable else 'required'} "
                f"to {'nullable' if field_b.nullable else 'required'}."
            )
            if diff_type == SchemaDiffType.IDENTICAL:
                diff_type = SchemaDiffType.NULLABILITY_CHANGED
            risk = _max_risk(risk, RiskLevel.MEDIUM)

        if field_a.metadata != field_b.metadata:
            details.append("Column metadata changed.")
            if diff_type == SchemaDiffType.IDENTICAL:
                diff_type = SchemaDiffType.METADATA_CHANGED
            risk = _max_risk(risk, RiskLevel.LOW)

        if include_order_changes and field_a.position != field_b.position:
            details.append(f"Column position changed from {field_a.position} to {field_b.position}.")
            if diff_type == SchemaDiffType.IDENTICAL:
                diff_type = SchemaDiffType.REORDERED
            risk = _max_risk(risk, RiskLevel.LOW)

        return ColumnDiff(
            column_name=field_b.name,
            name_a=field_a.name,
            name_b=field_b.name,
            diff_type=diff_type,
            risk_level=risk,
            data_type_a=field_a.data_type,
            data_type_b=field_b.data_type,
            nullable_a=field_a.nullable,
            nullable_b=field_b.nullable,
            metadata_a=field_a.metadata,
            metadata_b=field_b.metadata,
            encoding_a=field_a.encoding,
            encoding_b=field_b.encoding,
            position_a=field_a.position,
            position_b=field_b.position,
            details=details,
        )

    def _diff_renamed(self, field_a: _FieldInfo, field_b: _FieldInfo, similarity: float) -> ColumnDiff:
        details = [f"Possibly renamed from '{field_a.name}' to '{field_b.name}' (same data type)."]
        risk = RiskLevel.MEDIUM

        if field_a.nullable != field_b.nullable:
            details.append(
                f"Nullability changed from {'nullable' if field_a.nullable else 'required'} "
                f"to {'nullable' if field_b.nullable else 'required'}."
            )

        return ColumnDiff(
            column_name=field_b.name,
            name_a=field_a.name,
            name_b=field_b.name,
            diff_type=SchemaDiffType.RENAMED,
            risk_level=risk,
            data_type_a=field_a.data_type,
            data_type_b=field_b.data_type,
            nullable_a=field_a.nullable,
            nullable_b=field_b.nullable,
            metadata_a=field_a.metadata,
            metadata_b=field_b.metadata,
            encoding_a=field_a.encoding,
            encoding_b=field_b.encoding,
            position_a=field_a.position,
            position_b=field_b.position,
            rename_confidence=round(similarity, 2),
            details=details,
        )

    def _diff_removed(self, field_a: _FieldInfo) -> ColumnDiff:
        return ColumnDiff(
            column_name=field_a.name,
            name_a=field_a.name,
            name_b=None,
            diff_type=SchemaDiffType.REMOVED,
            risk_level=RiskLevel.HIGH,
            data_type_a=field_a.data_type,
            nullable_a=field_a.nullable,
            metadata_a=field_a.metadata,
            encoding_a=field_a.encoding,
            position_a=field_a.position,
            details=[f"Column '{field_a.name}' was removed in File B."],
        )

    def _diff_added(self, field_b: _FieldInfo) -> ColumnDiff:
        return ColumnDiff(
            column_name=field_b.name,
            name_a=None,
            name_b=field_b.name,
            diff_type=SchemaDiffType.ADDED,
            risk_level=RiskLevel.LOW,
            data_type_b=field_b.data_type,
            nullable_b=field_b.nullable,
            metadata_b=field_b.metadata,
            encoding_b=field_b.encoding,
            position_b=field_b.position,
            details=[f"Column '{field_b.name}' was added in File B."],
        )

    def _summarize(self, columns: list[ColumnDiff]) -> ComparisonSummary:
        added = sum(1 for c in columns if c.diff_type == SchemaDiffType.ADDED)
        removed = sum(1 for c in columns if c.diff_type == SchemaDiffType.REMOVED)
        renamed = sum(1 for c in columns if c.diff_type == SchemaDiffType.RENAMED)
        type_changes = sum(1 for c in columns if c.diff_type == SchemaDiffType.TYPE_CHANGED)
        nullability_changes = sum(1 for c in columns if c.diff_type == SchemaDiffType.NULLABILITY_CHANGED)
        metadata_changes = sum(1 for c in columns if c.diff_type == SchemaDiffType.METADATA_CHANGED)
        identical = sum(1 for c in columns if c.diff_type == SchemaDiffType.IDENTICAL)
        modified = renamed + type_changes + nullability_changes + metadata_changes
        total_differences = len(columns) - identical

        if any(c.risk_level == RiskLevel.HIGH for c in columns):
            health = SchemaHealth.BREAKING_CHANGES
        elif total_differences > 0:
            health = SchemaHealth.MINOR_DIFFERENCES
        else:
            health = SchemaHealth.MATCHING

        return ComparisonSummary(
            columns_added=added,
            columns_removed=removed,
            columns_modified=modified,
            type_changes=type_changes,
            nullability_changes=nullability_changes,
            metadata_changes=metadata_changes,
            renamed_columns=renamed,
            identical_columns=identical,
            total_differences=total_differences,
            health=health,
        )

    def _analyze_drift(self, columns: list[ColumnDiff], summary: ComparisonSummary) -> SchemaDriftAnalysis:
        total = len(columns) or 1
        match_percentage = round(100 * summary.identical_columns / total, 1)

        risk_weight = {RiskLevel.HIGH: 3, RiskLevel.MEDIUM: 2, RiskLevel.LOW: 1, RiskLevel.NONE: 0}
        weighted_penalty = sum(risk_weight[c.risk_level] for c in columns)
        max_penalty = total * 3
        drift_score = round(100 * weighted_penalty / max_penalty, 1) if max_penalty else 0.0

        if summary.total_differences == 0:
            explanation = "Schemas are identical - no drift detected."
        else:
            parts: list[str] = []
            if summary.columns_added:
                parts.append(f"{summary.columns_added} column(s) added")
            if summary.columns_removed:
                parts.append(f"{summary.columns_removed} column(s) removed")
            if summary.renamed_columns:
                parts.append(f"{summary.renamed_columns} column(s) possibly renamed")
            if summary.type_changes:
                parts.append(f"{summary.type_changes} data type change(s)")
            if summary.nullability_changes:
                parts.append(f"{summary.nullability_changes} nullability change(s)")
            if summary.metadata_changes:
                parts.append(f"{summary.metadata_changes} metadata change(s)")
            explanation = f"{match_percentage}% of columns are unchanged. Detected: " + ", ".join(parts) + "."

        return SchemaDriftAnalysis(
            drift_score=drift_score,
            match_percentage=match_percentage,
            explanation=explanation,
        )


def _max_risk(current: RiskLevel, candidate: RiskLevel) -> RiskLevel:
    order = {RiskLevel.NONE: 0, RiskLevel.LOW: 1, RiskLevel.MEDIUM: 2, RiskLevel.HIGH: 3}
    return candidate if order[candidate] > order[current] else current
