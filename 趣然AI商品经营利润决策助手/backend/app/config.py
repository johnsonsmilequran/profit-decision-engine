from functools import lru_cache

from pydantic import Field, HttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="QURAN_", extra="ignore")

    app_env: str = "development"
    database_url: str = Field(
        default="postgresql+psycopg://quran:quran@127.0.0.1:5432/quran", repr=False
    )
    public_base_url: HttpUrl = HttpUrl("http://localhost:8000")
    frontend_base_url: HttpUrl = HttpUrl("http://localhost:5173")
    session_ttl_seconds: int = 28_800
    auth_state_ttl_seconds: int = 600
    cookie_secure: bool = False
    support_guidance: str = "请联系公司 IT 核对钉钉应用与业务角色映射。"

    dingtalk_client_id: str = ""
    dingtalk_client_secret: str = ""
    dingtalk_authorize_url: HttpUrl = HttpUrl("https://login.dingtalk.com/oauth2/auth")
    dingtalk_token_url: HttpUrl = HttpUrl("https://api.dingtalk.com/v1.0/oauth2/userAccessToken")
    dingtalk_user_url: HttpUrl = HttpUrl("https://api.dingtalk.com/v1.0/contact/users/me")

    litellm_base_url: str = ""
    litellm_api_key: str = Field(default="", repr=False)
    litellm_model: str = ""
    litellm_timeout_seconds: float = 8.0

    max_upload_bytes: int = 10 * 1024 * 1024
    upload_spool_dir: str = "/tmp/quran-profit-uploads"
    worker_lease_seconds: int = 120
    worker_poll_seconds: float = 1.0

    @field_validator("app_env")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        allowed = {"development", "test", "production"}
        if value not in allowed:
            raise ValueError(f"app_env 必须为 {sorted(allowed)} 中的一项")
        return value

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.app_env != "production":
            return self
        failures: list[str] = []
        if not self.cookie_secure:
            failures.append("cookie_secure")
        if self.public_base_url.scheme != "https" or self.frontend_base_url.scheme != "https":
            failures.append("https_base_urls")
        if not self.dingtalk_ready:
            failures.append("dingtalk_credentials")
        if self.database_url == "postgresql+psycopg://quran:quran@127.0.0.1:5432/quran":
            failures.append("database_credentials")
        if failures:
            raise ValueError(f"生产安全配置不完整: {', '.join(failures)}")
        return self

    @property
    def dingtalk_ready(self) -> bool:
        return bool(self.dingtalk_client_id and self.dingtalk_client_secret)

    @property
    def litellm_ready(self) -> bool:
        return bool(self.litellm_base_url and self.litellm_api_key and self.litellm_model)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
