"""Application-wide custom exceptions and handlers."""
from fastapi import Request, status
from fastapi.responses import JSONResponse


class DataWorkbenchError(Exception):
    """Base exception for all application-specific errors."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ToolNotFoundError(DataWorkbenchError):
    """Raised when a requested tool id does not exist in the registry."""

    def __init__(self, tool_id: str) -> None:
        super().__init__(f"Tool '{tool_id}' was not found.", status.HTTP_404_NOT_FOUND)


class UnsupportedFileTypeError(DataWorkbenchError):
    """Raised when an uploaded file's type is not supported by a tool."""

    def __init__(self, file_name: str, supported: list[str]) -> None:
        super().__init__(
            f"'{file_name}' is not a supported file type. Supported types: "
            f"{', '.join(supported)}.",
            status.HTTP_400_BAD_REQUEST,
        )


class EmptyFileError(DataWorkbenchError):
    """Raised when an uploaded file contains no data."""

    def __init__(self, file_name: str) -> None:
        super().__init__(f"'{file_name}' is empty.", status.HTTP_400_BAD_REQUEST)


class FileTooLargeError(DataWorkbenchError):
    """Raised when an uploaded file exceeds the configured size limit."""

    def __init__(self, file_name: str, max_bytes: int) -> None:
        super().__init__(
            f"'{file_name}' exceeds the maximum upload size of "
            f"{max_bytes // (1024 * 1024)} MB.",
            status.HTTP_413_CONTENT_TOO_LARGE,
        )


class FileParseError(DataWorkbenchError):
    """Raised when an uploaded file cannot be parsed as its declared format."""

    def __init__(self, file_name: str, reason: str) -> None:
        super().__init__(
            f"Could not parse '{file_name}': {reason}",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )


class ReaderSessionNotFoundError(DataWorkbenchError):
    """Raised when a Parquet Reader session id is unknown or has expired."""

    def __init__(self, file_id: str) -> None:
        super().__init__(
            f"No active reader session for '{file_id}'. Upload the file again.",
            status.HTTP_404_NOT_FOUND,
        )


class ColumnNotFoundError(DataWorkbenchError):
    """Raised when a requested column name does not exist in a parquet file's schema."""

    def __init__(self, column_name: str) -> None:
        super().__init__(
            f"Column '{column_name}' was not found in this file's schema.",
            status.HTTP_404_NOT_FOUND,
        )


class ConversionError(DataWorkbenchError):
    """Raised when a file was parsed but could not be converted."""

    def __init__(self, file_name: str, reason: str) -> None:
        super().__init__(
            f"Failed to convert '{file_name}': {reason}",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )


class InvalidZipError(DataWorkbenchError):
    """Raised when an uploaded file is not a readable zip archive."""

    def __init__(self, file_name: str) -> None:
        super().__init__(
            f"'{file_name}' is not a valid zip archive.",
            status.HTTP_400_BAD_REQUEST,
        )


class MissingPbipFileError(DataWorkbenchError):
    """Raised when a PBIP project zip has no .pbip file at its root."""

    def __init__(self) -> None:
        super().__init__(
            "No .pbip file was found in the uploaded project. Expected a "
            "PBIP Project ZIP containing a .pbip file.",
            status.HTTP_400_BAD_REQUEST,
        )


class MissingReportFolderError(DataWorkbenchError):
    """Raised when a PBIP project zip has no <Name>.Report folder."""

    def __init__(self, pbip_name: str) -> None:
        super().__init__(
            f"No '{pbip_name}.Report' folder was found next to the .pbip file.",
            status.HTTP_400_BAD_REQUEST,
        )


class MissingSemanticModelFolderError(DataWorkbenchError):
    """Raised when a PBIP project zip has no <Name>.SemanticModel folder."""

    def __init__(self, pbip_name: str) -> None:
        super().__init__(
            f"No '{pbip_name}.SemanticModel' folder was found next to the .pbip file.",
            status.HTTP_400_BAD_REQUEST,
        )


class UnrecognizedSourceTypeError(DataWorkbenchError):
    """Raised when an upload is neither a PBIP project nor a LookML package."""

    def __init__(self, file_name: str) -> None:
        super().__init__(
            f"Could not determine whether '{file_name}' is a PBIP project or a LookML "
            "package. Expected a .pbip file (PBIP project) or .lkml files (LookML package).",
            status.HTTP_400_BAD_REQUEST,
        )


class LookerGenerationError(DataWorkbenchError):
    """Raised when PBIP parsing succeeded but LookML generation failed."""

    def __init__(self, reason: str) -> None:
        super().__init__(
            f"Failed to generate LookML: {reason}",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )


class BulkJobNotFoundError(DataWorkbenchError):
    """Raised when a bulk conversion job id is unknown or has expired."""

    def __init__(self, job_id: str) -> None:
        super().__init__(
            f"No bulk conversion job found for '{job_id}'. It may have expired or never existed.",
            status.HTTP_404_NOT_FOUND,
        )


class BulkJobNotReadyError(DataWorkbenchError):
    """Raised when a bulk conversion download/report is requested before the job finishes."""

    def __init__(self, job_id: str, status_value: str) -> None:
        super().__init__(
            f"Bulk conversion job '{job_id}' is not ready yet (status: {status_value}).",
            status.HTTP_409_CONFLICT,
        )


class NoPbipProjectsFoundError(DataWorkbenchError):
    """Raised when a bulk upload contains no discoverable .pbip files at all."""

    def __init__(self) -> None:
        super().__init__(
            "No .pbip files were found anywhere in the uploaded folder. Expected a parent "
            "folder containing one or more PBIP project subfolders.",
            status.HTTP_400_BAD_REQUEST,
        )


async def dataworkbench_exception_handler(request: Request, exc: DataWorkbenchError) -> JSONResponse:
    """Convert a DataWorkbenchError into a consistent JSON error response."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.__class__.__name__, "message": exc.message},
    )
