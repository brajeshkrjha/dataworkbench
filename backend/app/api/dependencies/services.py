"""Shared FastAPI dependencies (settings, services)."""
from functools import lru_cache

from app.core.config import Settings, get_settings
from app.services.parquet.conversion_service import ParquetConversionService
from app.services.parquet.reader_service import ParquetReaderService
from app.services.parquet.schema_comparison_service import ParquetSchemaComparisonService
from app.services.text_compare.service import TextCompareService
from app.services.tool_service import ToolService


def settings_dependency() -> Settings:
    """Provide application settings."""
    return get_settings()


@lru_cache
def get_tool_service_singleton() -> ToolService:
    """Provide a singleton ToolService instance."""
    return ToolService()


@lru_cache
def get_parquet_conversion_service_singleton() -> ParquetConversionService:
    """Provide a singleton ParquetConversionService instance."""
    return ParquetConversionService()


@lru_cache
def get_parquet_reader_service_singleton() -> ParquetReaderService:
    """Provide a singleton ParquetReaderService instance (holds in-memory sessions)."""
    return ParquetReaderService()


@lru_cache
def get_text_compare_service_singleton() -> TextCompareService:
    """Provide a singleton TextCompareService instance."""
    return TextCompareService()


@lru_cache
def get_parquet_schema_comparison_service_singleton() -> ParquetSchemaComparisonService:
    """Provide a singleton ParquetSchemaComparisonService instance (stateless)."""
    return ParquetSchemaComparisonService()
