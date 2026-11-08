"""Pluggable comparator-provider interface.

Each comparison "engine" (text, structured, CSV, SQL, ...) implements
`BaseComparator.compare` and returns a `ComparatorOutput`. The service
layer dispatches to exactly one comparator based on the resolved type,
avoiding a single giant comparison method.
"""
from dataclasses import dataclass

from app.schemas.text_compare import (
    CsvComparisonDetail,
    SqlComparisonDetail,
    StructuredComparisonDetail,
)


@dataclass
class ComparatorOutput:
    added: int
    removed: int
    modified: int
    identical: int
    similarity_score: float
    structured_detail: StructuredComparisonDetail | None = None
    csv_detail: CsvComparisonDetail | None = None
    sql_detail: SqlComparisonDetail | None = None


class BaseComparator:
    def compare(self, text_a: str, text_b: str) -> ComparatorOutput:
        raise NotImplementedError
