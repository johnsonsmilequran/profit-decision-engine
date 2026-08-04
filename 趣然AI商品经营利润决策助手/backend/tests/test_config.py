import pytest
from pydantic import ValidationError

from app.config import Settings


def test_production_configuration_fails_closed_with_development_defaults() -> None:
    with pytest.raises(ValidationError, match="生产安全配置不完整"):
        Settings(app_env="production")


def test_production_configuration_accepts_https_and_deployment_secrets() -> None:
    settings = Settings(
        app_env="production",
        database_url="postgresql+psycopg://app:deployment-secret@postgres:5432/quran",
        public_base_url="https://profit.example.internal",
        frontend_base_url="https://profit.example.internal",
        cookie_secure=True,
        dingtalk_client_id="deployment-client",
        dingtalk_client_secret="deployment-secret",
    )
    assert settings.app_env == "production"
