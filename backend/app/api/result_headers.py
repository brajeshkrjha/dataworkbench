"""Response header names exposed via CORS.

Kept free of heavy imports so the app can configure CORS without loading
the pandas/pyarrow-backed routers.
"""

PARQUET_RESULT_HEADERS = [
    "X-Conversion-File-Name",
    "X-Conversion-Source-Format",
    "X-Conversion-Compression",
    "X-Conversion-Row-Count",
    "X-Conversion-Column-Count",
    "X-Conversion-Source-Bytes",
    "X-Conversion-Output-Bytes",
]

LOOKER_RESULT_HEADERS = [
    "X-Looker-Project-Name",
    "X-Looker-Views-Generated",
    "X-Looker-Explores-Generated",
    "X-Looker-Relationships-Found",
    "X-Looker-Measures-Found",
]
