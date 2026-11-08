"""Application configuration, loaded from environment variables."""
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings.

    Values are typed and validated at startup. `environment` controls
    validation strictness: in "production", settings that default to
    localhost-friendly values for local dev (e.g. `cors_origins`) must
    be explicitly provided - we fail loudly instead of silently
    running with dev defaults.
    """

    model_config = SettingsConfigDict(env_file=".env", env_prefix="DWB_", extra="ignore")

    app_name: str = "DataWorkbench"
    app_tagline: str = "Everyday Tools for Data Engineers"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = True

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    max_upload_bytes: int = 200 * 1024 * 1024

    @model_validator(mode="after")
    def _validate_production_config(self) -> "Settings":
        if self.environment == "production":
            localhost_origins = {
                origin for origin in self.cors_origins if "localhost" in origin or "127.0.0.1" in origin
            }
            if not self.cors_origins or localhost_origins == set(self.cors_origins):
                raise ValueError(
                    "DWB_CORS_ORIGINS must be explicitly set to real origin(s) when "
                    "DWB_ENVIRONMENT=production. Refusing to silently fall back to "
                    "localhost defaults."
                )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
