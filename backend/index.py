"""Vercel entrypoint: exposes the FastAPI app as `app` for zero-config deployment."""
from app.main import app  # noqa: F401
