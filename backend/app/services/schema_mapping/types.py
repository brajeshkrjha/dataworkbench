"""Mapping between the user-facing `MappedDataType` enum and Arrow types.

`MappedDataType` is deliberately a small, practical set ("enterprise"
datatypes an analyst thinks in - String/Integer/Long/.../Timestamp)
rather than the full Arrow type system, so the override UI stays simple.
"""
import pyarrow as pa

from app.schemas.parquet import MappedDataType

_TO_ARROW: dict[MappedDataType, pa.DataType] = {
    MappedDataType.STRING: pa.string(),
    MappedDataType.INTEGER: pa.int32(),
    MappedDataType.LONG: pa.int64(),
    MappedDataType.DOUBLE: pa.float64(),
    MappedDataType.DECIMAL: pa.decimal128(38, 9),
    MappedDataType.BOOLEAN: pa.bool_(),
    MappedDataType.DATE: pa.date32(),
    MappedDataType.TIMESTAMP: pa.timestamp("us"),
}


def to_arrow_type(data_type: MappedDataType) -> pa.DataType:
    """Resolve a `MappedDataType` override to the Arrow type used to cast it."""
    return _TO_ARROW[data_type]


def from_arrow_type(arrow_type: pa.DataType) -> MappedDataType:
    """Classify an Arrow type back into the closest `MappedDataType`.

    Used both to report "detected type" during schema inspection and to
    summarize the final written parquet schema after conversion.
    """
    if pa.types.is_boolean(arrow_type):
        return MappedDataType.BOOLEAN
    if pa.types.is_decimal(arrow_type):
        return MappedDataType.DECIMAL
    if pa.types.is_date(arrow_type):
        return MappedDataType.DATE
    if pa.types.is_timestamp(arrow_type):
        return MappedDataType.TIMESTAMP
    if pa.types.is_floating(arrow_type):
        return MappedDataType.DOUBLE
    if pa.types.is_integer(arrow_type):
        bit_width = getattr(arrow_type, "bit_width", 32)
        return MappedDataType.LONG if bit_width > 32 else MappedDataType.INTEGER
    return MappedDataType.STRING
