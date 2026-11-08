"""Default comparator: plain line-level text diff."""
from app.services.text_compare.comparators.base import BaseComparator, ComparatorOutput
from app.services.text_compare.diff_utils import line_diff, similarity_ratio


class TextComparator(BaseComparator):
    def compare(self, text_a: str, text_b: str) -> ComparatorOutput:
        _, counts = line_diff(text_a, text_b)
        return ComparatorOutput(
            added=counts["added"],
            removed=counts["removed"],
            modified=counts["modified"],
            identical=counts["identical"],
            similarity_score=similarity_ratio(text_a, text_b),
        )
