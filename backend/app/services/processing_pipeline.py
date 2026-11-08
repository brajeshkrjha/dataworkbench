"""Foundational, reusable file-processing pipeline abstraction.

Future tools (CSV to Parquet, formatters, etc.) will implement the
`ProcessingPipeline` protocol to plug into a common execution flow
without duplicating orchestration logic.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

InputT = TypeVar("InputT")
OutputT = TypeVar("OutputT")


@dataclass
class PipelineResult(Generic[OutputT]):
    """Outcome of running a processing pipeline."""

    success: bool
    output: OutputT | None = None
    errors: list[str] | None = None


class ProcessingPipeline(ABC, Generic[InputT, OutputT]):
    """Base class for a reusable file/data processing pipeline.

    Subclasses implement `process`. Shared concerns (validation hooks,
    error accumulation) live here so individual tools stay small.
    """

    @abstractmethod
    def process(self, data: InputT) -> PipelineResult[OutputT]:
        """Execute the pipeline against the given input and return a result."""
        raise NotImplementedError

    def run(self, data: InputT) -> PipelineResult[OutputT]:
        """Public entry point with a shared error-handling boundary."""
        try:
            return self.process(data)
        except Exception as exc:  # noqa: BLE001 - convert any failure into a result
            return PipelineResult(success=False, output=None, errors=[str(exc)])


def new_job_id() -> str:
    """Generate a unique identifier for a processing job."""
    import uuid

    return str(uuid.uuid4())


__all__: list[str] = [
    "Any",
    "PipelineResult",
    "ProcessingPipeline",
    "new_job_id",
]
