"""Reusable schema/datatype mapping engine.

Backs the "Convert Files" schema-inspection and datatype-override
workflow. Built to be format-agnostic: `inspector.py` samples rows and
reports detected types using Arrow's type system, and `types.py` maps
between the user-facing `MappedDataType` enum and Arrow types. Any
future source format (Excel, TSV, XML, ...) that can be read into an
Arrow table can reuse both without CSV-specific code.
"""
