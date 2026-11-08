"""In-memory job store for bulk PBIP -> LookML conversion.

A bulk upload can contain hundreds of projects, so conversion runs on a
background thread while the frontend polls for progress instead of holding
one long HTTP request open. Jobs live only for the process lifetime -
acceptable for this tool (no auth/multi-instance deployment yet), same
tradeoff the Parquet Reader session store already makes.
"""
import threading
import time
import uuid


class BulkJob:
    """Mutable progress/result state for one bulk conversion, shared between the
    background worker thread and the polling HTTP handlers. Individual attribute
    reads/writes and `list.append` are already atomic under the GIL, so no lock is
    taken for the simple progress fields - only used where an entire object is read."""

    def __init__(self, job_id: str) -> None:
        self.job_id = job_id
        self.status = "discovering"  # discovering -> processing -> completed -> failed
        self.total = 0
        self.processed = 0
        self.current_project: str | None = None
        self.discovery: dict | None = None
        self.successes: list[dict] = []
        self.failures: list[dict] = []
        self.zip_bytes: bytes | None = None
        self.output_file_name: str | None = None
        self.error: str | None = None
        self.created_at = time.time()


_jobs: dict[str, BulkJob] = {}
_jobs_lock = threading.Lock()


def create_job() -> BulkJob:
    job = BulkJob(uuid.uuid4().hex)
    with _jobs_lock:
        _jobs[job.job_id] = job
    return job


def get_job(job_id: str) -> BulkJob | None:
    with _jobs_lock:
        return _jobs.get(job_id)
