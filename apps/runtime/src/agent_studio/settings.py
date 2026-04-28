from __future__ import annotations

from typing import ClassVar

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class RuntimeSettings(BaseSettings):
    service_name: str = Field(default="agent-studio", alias="RUNTIME_SERVICE_NAME")
    agent_model: str = Field(
        default="anthropic:claude-opus-4-6",
        alias="DEFAULT_AGENT_MODEL",
    )
    workspace_root: str = Field(default="/workspace", alias="WORKSPACE_ROOT")
    database_uri: str = Field(
        default="postgresql://langgraph:langgraph@postgres:5432/langgraph",
        alias="DATABASE_URI",
    )
    redis_uri: str | None = Field(default=None, alias="REDIS_URI")
    dev_mode: bool = Field(default=False, alias="DEV_MODE")
    admin_hosts: str = Field(
        default="localhost,127.0.0.1,admin.localhost,admin.agent-studio.orb.local",
        alias="ADMIN_HOSTS",
    )
    site_domain_suffixes: str = Field(
        default="localhost,agent-studio.orb.local",
        alias="SITE_DOMAIN_SUFFIXES",
    )
    default_site: str | None = Field(default=None, alias="DEFAULT_SITE")
    default_site_hosts: str = Field(default="", alias="DEFAULT_SITE_HOSTS")

    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        env_ignore_empty=True,
        extra="ignore",
    )


settings = RuntimeSettings()
