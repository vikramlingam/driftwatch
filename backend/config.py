"""Environment-backed configuration for DriftWatch."""
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    bright_data_api_token: str = ""
    bright_data_collector_id: str = ""
    database_path: str = "driftwatch.db"
    default_target_urls: str = "https://docs.stripe.com/changelog"
    target_url: str = ""
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    frontend_origins: str = "http://localhost:3000"
    next_public_backend_url: str = "http://localhost:8000"
    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-3.5-sonnet"
    github_token: str = ""
    github_username: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    custom_target_urls: list[str] = Field(default_factory=list)

    @property
    def target_urls(self) -> list[str]:
        value = self.target_url or self.default_target_urls
        base_urls = [u.strip().strip("'\"") for u in value.strip("[]").split(",") if u.strip()]
        return list(dict.fromkeys(base_urls + self.custom_target_urls))

    def add_target_url(self, url: str) -> None:
        if url not in self.custom_target_urls:
            self.custom_target_urls.append(url)

    @property
    def db_path(self) -> Path:
        p = Path(self.database_path)
        if not p.is_absolute():
            return ROOT_DIR / p
        return p


settings = Settings()
